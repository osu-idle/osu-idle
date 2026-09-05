import { z } from 'zod';
import { Grades } from './judgement.js';
import { Skills } from './skills.js';
import { scoreDTO } from './score.js';

/**
 * The play protocol. Ranked plays are server-authoritative end to end and ride
 * the community WebSocket: these are the play-scoped variants composed into the
 * shared `clientMessage`/`serverMessage` unions (community/wire.ts). The flow:
 * `play:start` starts-or-joins, `play:watch` arms a server-side feed that pushes
 * `play:offsets` (gameplay) or `play:state` checkpoints (resume banner), and
 * skip/abort/result are one-shot commands. State changes (start, finish, abort)
 * are pushed to every one of the character's sockets.
 */

/** One replayed input as it streams to the client - mirrors the sim's
 *  `ReplayOffset`. */
export const replayOffsetDTO = z.object({
	id: z.string(),
	tail: z.literal(true).optional(),
	offset: z.number().optional(),
});

/** A slice of the replay stream: the offsets revealed so far, the resume
 *  cursor, and whether every offset has been delivered. */
const offsetChunk = {
	offsets: z.array(replayOffsetDTO),
	next: z.number().int().min(0),
	done: z.boolean(),
};

/** Outcome of `play:start`. `ranked` carries everything the client needs to
 *  replay the play seeked to its live position; timestamps are server-clock ms
 *  (`serverNow` lets the client absorb clock skew). */
export const playStartResultDTO = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('ranked'),
		/** joined the play already in progress (spectate) instead of starting */
		joined: z.boolean(),
		token: z.string(),
		/** what is actually being played - a join can differ from the request */
		beatmapId: z.number().int(),
		startedAt: z.number(),
		endsAt: z.number(),
		serverNow: z.number(),
		...offsetChunk,
	}),
	z.object({ status: z.literal('unranked') }),
	z.object({ status: z.literal('refused') }),
]);
export type PlayStartResult = z.infer<typeof playStartResultDTO>;

/** What (if anything) the character is playing. Pushed on connect, on every
 *  play start/finish/abort, and while a state watch is armed. `accuracy`/
 *  `grade` are the score checkpoint at the live position. */
export const playStateDTO = z.discriminatedUnion('phase', [
	z.object({
		phase: z.literal('active'),
		token: z.string(),
		beatmapId: z.number().int(),
		startedAt: z.number(),
		endsAt: z.number(),
		serverNow: z.number(),
		accuracy: z.number().optional(),
		grade: z.enum(Grades).optional(),
	}),
	z.object({
		phase: z.literal('finished'),
		token: z.string(),
		/** finalised server-side (the sweep) and not yet surfaced to any client */
		notify: z.boolean(),
	}),
	z.object({ phase: z.literal('idle') }),
]);
export type PlayState = z.infer<typeof playStateDTO>;

/** A skill's level/xp before and after the play - the sim's `SkillProgress`. */
export const skillGainDTO = z.object({
	skill: z.enum(Skills),
	gained: z.number(),
	fromLevel: z.number().int(),
	fromXp: z.number(),
	toLevel: z.number().int(),
	toXp: z.number(),
	levels: z.number().int(),
});
export type SkillGain = z.infer<typeof skillGainDTO>;

/** What the play changed on the character's profile: ranked score, pp and
 *  global (pp) rank, before vs after. `rank` is positive when the player
 *  climbed. */
export const playDeltasDTO = z.object({
	rank: z.number().int(),
	rankedScore: z.number(),
	pp: z.number(),
});
export type PlayDeltas = z.infer<typeof playDeltasDTO>;

/** Outcome of `play:result`. Not-ok reasons: `unknown` = no such play/result,
 *  `cache-miss` = already surfaced elsewhere, `unfinalized` = the finalise
 *  failed, `tooSoon` = the play hasn't ended yet. */
export const playResultDTO = z.discriminatedUnion('ok', [
	z.object({
		ok: z.literal(true),
		failed: z.boolean(),
		score: scoreDTO.optional(),
		gains: z.array(skillGainDTO).optional(),
		deltas: playDeltasDTO.optional(),
	}),
	z.object({
		ok: z.literal(false),
		reason: z.enum(['unknown', 'cache-miss', 'unfinalized', 'tooSoon']),
	}),
]);
export type PlayResult = z.infer<typeof playResultDTO>;

/** Client -> server play variants. */
export const playClientMessages = [
	// start a ranked play, or join the one already in progress (start-or-join)
	z.object({
		type: z.literal('play:start'),
		beatmapId: z.number().int(),
		/** debug only, pinned to 1 in production: scales the play's xp so
		 *  progression thresholds are reachable while testing. Deliberately
		 *  unbounded - a ceiling here rejects the whole start message, so a debug
		 *  knob could stop a song from starting at all. */
		xpMultiplier: z.number().int().positive().optional(),
	}),
	// arm this socket's play feed: with `next`, stream replay offsets from that
	// cursor; without it, push live state checkpoints (the resume banner)
	z.object({
		type: z.literal('play:watch'),
		token: z.string(),
		next: z.number().int().min(0).optional(),
	}),
	z.object({ type: z.literal('play:unwatch') }),
	// lead-in skip: shift the play's timeline so it finalises earlier
	z.object({
		type: z.literal('play:skip'),
		token: z.string(),
	}),
	// debug only: end the play now, so its authoritative result can be read
	// without waiting out the map in real time. Refused on a production server.
	z.object({
		type: z.literal('play:finish'),
		token: z.string(),
		/** where the client's replay got to, so the answer carries the rest */
		next: z.number(),
	}),
	// quit: drop the play without submitting
	z.object({
		type: z.literal('play:abort'),
		token: z.string(),
	}),
	z.object({
		type: z.literal('play:result'),
		token: z.string(),
		forceSee: z.boolean().optional(),
	}),
] as const;

/** Server -> client play variants. */
export const playServerMessages = [
	z.object({
		type: z.literal('play:start'),
		result: playStartResultDTO,
	}),
	z.object({
		type: z.literal('play:state'),
		state: playStateDTO,
	}),
	z.object({
		type: z.literal('play:offsets'),
		token: z.string(),
		...offsetChunk,
	}),
	// the play was aborted (possibly from another device) - stop spectating it
	z.object({
		type: z.literal('play:aborted'),
		token: z.string(),
	}),
	z.object({
		type: z.literal('play:result'),
		token: z.string(),
		result: playResultDTO,
	}),
] as const;
