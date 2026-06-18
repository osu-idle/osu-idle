import { Bot, type BotContext, type InputEvent } from '@osu-idle/shared/sim/bot';
import { ReplayOffset } from '@osu-idle/shared/sim/maniaGame';

/**
 * Replays a server-computed play: instead of generating timing error from the
 * character's skills, it emits the exact per-input offsets the server's bot
 * produced. Because judgement is pure given `(offset, windows)`, feeding these
 * through `ManiaGame` reproduces the server's score exactly. A null offset is an
 * intentional miss (Infinity → ignored input), matching the base bot.
 */
export default class ReplayBot extends Bot {
	private head = new Map<string, number | undefined>();
	private tail = new Map<string, number | undefined>();

	constructor(offsets: ReplayOffset[]) {
		super();
		for (const o of offsets) (o.tail ? this.tail : this.head).set(o.id, o.offset);
	}

	// unused - generateEvents is overridden to pull offsets from the maps
	pressOffset(): number { return 0; }
	releaseOffset(): number { return 0; }

	generateEvents(ctx: BotContext): InputEvent[] {
		const events: InputEvent[] = [];
		ctx.inputs = events;
		for (const note of ctx.notes) {
			const h = this.head.get(note.getId());
			const ho = h == null ? Infinity : h;
			events.push({ time: note.time + ho, column: note.column, action: 'press', note, tail: false, ignore: !isFinite(ho) });
			if (note.hold) {
				const t = this.tail.get(note.getId());
				const to = t == null ? Infinity : t;
				events.push({ time: note.endTime + to, column: note.column, action: 'release', note, tail: true, ignore: !isFinite(to) });
			}
		}
		events.sort((a, b) => a.time - b.time);
		return events;
	}
}
