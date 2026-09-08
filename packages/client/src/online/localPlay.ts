import { Beatmap } from 'osu-classes';
import Synced from '@osu-idle/shared/helpers/synced';
import {
	LEAD_IN_MS,
	ManiaGame,
	type ReplayOffset,
} from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, { type SkillProgress } from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import Memory from '@osu-idle/shared/sim/skills/memory';
import { hasUnlock } from '@osu-idle/shared/rebirth';
import type { Grade } from '@osu-idle/shared/judgement';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import Character from '../db/schema/character';
import { Score } from '../db/schema/score';
import { ScoreXP } from '../db/schema/score_xp';
import { logPlayFinished } from '../logs';
import calculatePP from '../osu/pp';
import { debugXpMultiplier } from '../globals';

/** Song-time gap between the accuracy/grade checkpoints the dock reads. */
const SAMPLE_STEP_MS = 5000;

/** How long a finished local play stays readable, so a scene that arrives late
 *  still gets its result. */
const RESULT_TTL_MS = 10 * 60 * 1000;

export type LocalScoring = 'guest' | 'unranked';

/** The client-side twin of the server's pending play. Everything about the play
 *  is decided here, when it starts. */
type LocalRun = {
	token: string;
	mode: LocalScoring;
	/** the character this play was started for. A guest rebirth mid-play swaps
	 *  the live one, and the play belongs to the one that earned it. */
	character: Character;
	beatmap: LightBeatmap;
	beatmapId: number;
	chart: Beatmap;
	/** the resolved simulation - the play, in full, before a note is drawn */
	game: ManiaGame;
	/** the analysis that produced it, so the strain HUD shows the play being
	 *  watched rather than a second, different one */
	bot: CharacterBot;
	offsets: ReplayOffset[];
	startedAt: number;
	endsAt: number;
	songStartMs: number;
	samples: [number, number, Grade][];
	timer: number;
};

export type LocalPlayState = {
	phase: 'active';
	token: string;
	beatmapId: number;
	startedAt: number;
	endsAt: number;
	accuracy: number;
	grade: Grade;
} | {
	phase: 'finished';
	token: string;
	beatmapId: number;
};

export type LocalResult = {
	token: string;
	beatmap: LightBeatmap;
	failed: boolean;
	score?: Score;
	gains?: SkillProgress[];
};

/**
 * A play the client owns, run the way the server runs a ranked one.
 *
 * The map is simulated in full the moment it starts, and the outcome is stored;
 * what remains is a clock. That is what lets a guest or an unranked play keep
 * running while the player is in song select, on the character page, or nowhere
 * near a playfield - and it makes "the outcome is decided at start" true of
 * every play, which is what the deferred purchases rely on.
 *
 * The gameplay scene is a viewer over it, replaying the same offsets a ranked
 * play replays.
 */
export const localPlayState = new Synced<LocalPlayState | undefined>(undefined);

let current: LocalRun | undefined;
let result: { at: number, value: LocalResult } | undefined;
/** A start in flight, so a second caller for the same map joins it rather than
 *  racing it. The guard below spans two awaits, which is long enough for the
 *  gameplay scene and a background chain to both get through. */
let starting: { beatmapId: number, run: Promise<LocalRun> } | undefined;

export const currentLocalPlay = (): LocalRun | undefined => current;

/**
 * The character's skills as they are right now, detached.
 *
 * The bot would otherwise hold the live instances, and it reads them again at
 * finalise - through `applyProgression`, whose xp multiplier comes off
 * `upgrades`/`overdrive`. Buying an upgrade during a play would then pay out on
 * the play already in flight, which is the very thing the deferred purchases
 * exist to prevent. This is what the server does with `loadCharacterSkills`.
 */
const snapshotSkills = (character: Character, timesPlayed: number) => {
	const skills = makeOrderedSkills();
	for (const skill of skills) {
		const live = character.skills.find(s => s.name === skill.name);
		if (!live) continue;
		void skill.level.set(live.level.get());
		void skill.xp.set(live.xp.get());
		void skill.upgrades.set(live.upgrades.get());
		void skill.overdrive.set(live.overdrive.get());
		void skill.prestige.set(live.prestige.get());
		if (skill instanceof Memory) void skill.timesPlayed.set(timesPlayed);
	}
	return skills;
};

/** Where the play has got to, in song time. */
const positionOf = (run: LocalRun): number => Date.now() - run.startedAt - LEAD_IN_MS;

const sampleAt = (run: LocalRun, at: number): [number, Grade] => {
	let acc = 1;
	let grade: Grade = 'X';
	for (const [t, a, g] of run.samples) {
		if (t > at) break;
		acc = a;
		grade = g;
	}
	return [acc, grade];
};

const publish = (run: LocalRun): void => {
	const [accuracy, grade] = sampleAt(run, positionOf(run));
	void localPlayState.set({
		phase: 'active',
		token: run.token,
		beatmapId: run.beatmapId,
		startedAt: run.startedAt,
		endsAt: run.endsAt,
		accuracy,
		grade,
	});
};

/**
 * Start (or join) the local play for a difficulty. Joining matters for the same
 * reason it does server-side: a second scene mounting must watch the play that
 * is running, not start a rival one.
 */
export const startLocalPlay = async (
	character: Character,
	beatmap: LightBeatmap,
	chart: Beatmap,
	mode: LocalScoring,
): Promise<LocalRun> => {
	const beatmapId = chart.metadata.beatmapId;
	if (current && current.beatmapId === beatmapId) return current;
	if (starting?.beatmapId === beatmapId) return starting.run;

	const run = simulate(character, beatmap, chart, mode, beatmapId);
	starting = {
		beatmapId, run,
	};
	try {
		return await run;
	} finally {
		if (starting?.run === run) starting = undefined;
	}
};

const simulate = async (
	character: Character,
	beatmap: LightBeatmap,
	chart: Beatmap,
	mode: LocalScoring,
	beatmapId: number,
): Promise<LocalRun> => {
	const timesPlayed = await Score.countPlays(
		character.id,
		beatmapId,
		character.memoryResetAt,
	);

	const divine = hasUnlock(character.generation, 'DIVINE');
	const bot = new CharacterBot(
		snapshotSkills(character, timesPlayed),
		chart.difficulty.overallDifficulty,
	);
	const game = new ManiaGame(chart, bot, { divine });

	// walk to the end in steps, checkpointing accuracy and grade on the way -
	// the dock reads these back while the play runs
	const samples: [number, number, Grade][] = [];
	for (let t = 0; t <= game.songEndMs; t += SAMPLE_STEP_MS) {
		game.update(t);
		samples.push([t, game.score.accuracy, game.score.grade]);
	}
	game.update(game.songEndMs + 1000);

	const failedAt = game.score.failed ? game.score.failedIndex : undefined;
	const lastNoteEnd = game.notes.reduce(
		(m, n) => Math.max(m, n.hold ? n.endTime : n.time), 0,
	);
	const endSongTime = failedAt ? game.hits[failedAt - 1].time : lastNoteEnd;
	const startedAt = Date.now();

	const run: LocalRun = {
		token: `local-${startedAt}-${beatmapId}`,
		mode,
		character,
		beatmap,
		beatmapId,
		chart,
		game,
		bot,
		offsets: game.replayOffsets(),
		startedAt,
		endsAt: startedAt + LEAD_IN_MS + endSongTime,
		songStartMs: game.songStartMs,
		samples,
		timer: 0,
	};
	// Replaced only once the new one is ready: dropping the old play first leaves
	// a moment with no local state, which reads as a play ending - the manager
	// would start a countdown for the queue's next map against this one booting.
	if (current) abortLocalPlay(current.token);
	current = run;
	run.timer = window.setTimeout(
		() => void finalizeLocalPlay(run.token),
		Math.max(0, run.endsAt - Date.now()),
	);
	publish(run);
	return run;
};

/** Refresh the live checkpoint the dock shows. */
export const pollLocalPlay = (): void => {
	if (current) publish(current);
};

/** Pull the timeline in so the play ends now - the local twin of asking the
 *  server to finish. Used by the skip, which already holds the whole replay. */
export const finishLocalPlay = (token: string): void => {
	if (!current || current.token !== token) return;
	window.clearTimeout(current.timer);
	void finalizeLocalPlay(token);
};

export const abortLocalPlay = (token: string): void => {
	if (!current || current.token !== token) return;
	window.clearTimeout(current.timer);
	current = undefined;
	if (localPlayState.get()) void localPlayState.set(undefined);
};

/**
 * Close the play out: build its score, save it, award what it earned. The one
 * place a local play's result is decided, whether or not a scene watched it -
 * two owners would mean two payouts.
 */
export const finalizeLocalPlay = async (token: string): Promise<void> => {
	const run = current;
	if (!run || run.token !== token) return;
	current = undefined;
	window.clearTimeout(run.timer);

	const character = run.character;
	const game = run.game;
	const failed = game.score.failed;

	const pp = await calculatePP(game.score, run.chart).catch(() => 0);
	const c = game.score.counts;
	const score = new Score({
		characterId: Number(character.id),
		beatmapId: run.beatmapId,
		score: Math.round(game.score.score),
		accuracy: game.score.accuracy,
		maxCombo: game.score.maxCombo,
		...c,
		grade: game.score.grade,
		pp,
		ur: game.unstableRate(),
		pfc: c.MISS === 0 && c.BAD === 0 && c.GOOD === 0,
		playedAt: Date.now(),
	});

	let saved = score;
	let gains: SkillProgress[] | undefined;
	// a failed play is never saved or paid for; an unranked one is saved but
	// earns nothing, the same rules the scene used to apply
	if (!failed) {
		saved = await score.add().catch(() => score);
		if (run.mode === 'guest') {
			gains = run.bot.applyProgression(
				run.beatmap.metadata.total_length,
				saved,
				debugXpMultiplier.get(),
			);
			// the bot earned it on its own copy of the skills, so hand the gains to
			// the live ones - which may have moved since the play started
			for (const gain of gains) {
				character.skills.find(s => s.name === gain.skill)?.gainXP(gain.gained);
			}
			void character.addProgression(gains);
			void ScoreXP.record(saved, gains);
		}
		logPlayFinished(saved, run.beatmap, gains);
	}

	result = {
		at: Date.now(),
		value: {
			token,
			beatmap: run.beatmap,
			failed,
			score: failed ? undefined : saved,
			gains,
		},
	};
	void localPlayState.set({
		phase: 'finished', token, beatmapId: run.beatmapId,
	});
};

/** The finished play's result, once it has one. Mirrors the server's result
 *  read: a scene asks, and waits if the play is still running. */
export const localPlayResult = (token: string): LocalResult | undefined => {
	if (!result || result.value.token !== token) return undefined;
	if (Date.now() - result.at > RESULT_TTL_MS) {
		result = undefined;
		return undefined;
	}
	return result.value;
};
