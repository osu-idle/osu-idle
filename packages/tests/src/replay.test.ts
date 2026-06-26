import '@osu-idle/shared/osu/controlPointPatch';
import {
	describe,
	it,
	expect,
} from 'vitest';
import { BeatmapDecoder } from 'osu-parsers';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import ReplayBot from '@osu-idle/client/gameplay/replayBot';
import { simulate } from './sim';

// A tiny hand-written 4K mania chart - a few taps and two long notes, enough to
// exercise head/tail streaming and the schedule re-sort.
const CHART = `osu file format v14

[General]
Mode: 3

[Difficulty]
HPDrainRate:6
CircleSize:4
OverallDifficulty:8
ApproachRate:5
SliderMultiplier:1.4
SliderTickRate:1

[TimingPoints]
0,300,4,1,0,100,1,0

[HitObjects]
64,192,1000,1,0,0:0:0:0:
192,192,1000,1,0,0:0:0:0:
320,192,1200,1,0,0:0:0:0:
448,192,1400,128,0,1800:0:0:0:0:
64,192,1600,1,0,0:0:0:0:
192,192,1800,128,0,2200:0:0:0:0:
320,192,2000,1,0,0:0:0:0:
448,192,2200,1,0,0:0:0:0:
64,192,2400,1,0,0:0:0:0:
192,192,2600,1,0,0:0:0:0:
320,192,2800,1,0,0:0:0:0:
448,192,3000,1,0,0:0:0:0:
`;

const beatmap = new BeatmapDecoder().decodeFromString(CHART);

describe('streamed replay equivalence', () => {
	it('reproduces the all-at-once score when offsets are fed a few at a time', () => {
		// A real authoritative play - the source of the offsets the client replays.
		const authoritative = simulate(beatmap, 30);
		const offsets = authoritative.replayOffsets();

		// reveal time = the offset's note nominal time (head time / tail endTime),
		// exactly the order/horizon the server streams by.
		const noteById = new Map(authoritative.notes.map(n => [n.getId(), n]));
		const revealOf = (o: typeof offsets[number]) => {
			const note = noteById.get(o.id)!;
			return o.tail ? note.endTime : note.time;
		};
		const ordered = [...offsets].sort((a, b) => revealOf(a) - revealOf(b));

		const BUFFER = 200;
		const STEP = 37;
		const start = authoritative.songStartMs;
		const end = authoritative.songEndMs + 1000;

		// Build the replay with only the first slice known, then stream the rest in.
		let cursor = 0;
		const within = (t: number) => {
			const from = cursor;
			while (cursor < ordered.length && revealOf(ordered[cursor]) <= t) cursor++;
			return ordered.slice(from, cursor);
		};

		const bot = new ReplayBot(within(start + BUFFER));
		const game = new ManiaGame(beatmap, bot);

		for (let t = start; t <= end; t += STEP) {
			game.appendReplay(bot.addOffsets(within(t + BUFFER)));
			game.update(t);
		}
		// flush anything left and settle on the end
		game.appendReplay(bot.addOffsets(ordered.slice(cursor)));
		game.update(end);

		expect(game.score.score).toBe(authoritative.score.score);
		expect(game.score.accuracy).toBe(authoritative.score.accuracy);
		expect(game.score.maxCombo).toBe(authoritative.score.maxCombo);
		expect(game.score.grade).toBe(authoritative.score.grade);
		expect(game.score.counts).toEqual(authoritative.score.counts);
		expect(game.hits).toEqual(authoritative.hits);
	});
});
