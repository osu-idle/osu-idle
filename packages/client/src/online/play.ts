import Synced from '@osu-idle/shared/helpers/synced';
import type { PlayState } from '@osu-idle/shared/play';
import type { ReplayOffset } from '@osu-idle/shared/sim/maniaGame';
import type Character from '../db/schema/character';
import { showDeltas } from '../globals';
import Socket from './socket';
import { debugXpMultiplier } from '../globals';

/** Generous: a start awaits the server-side simulation of the whole map. */
const START_TIMEOUT_MS = 20_000;
const RESULT_TIMEOUT_MS = 10_000;

export type RankedPlayContext = {
	mode: 'ranked';
	token: string;
	/** what the server is actually playing - a join can differ from the request */
	beatmapId: number;
	/** the offsets revealed so far; the rest are pushed while `play:watch`ed */
	offsets: ReplayOffset[];
	/** resume cursor + whether every offset has already been delivered */
	next: number;
	done: boolean;
	startedAt: number;
	endsAt: number
};

/** A play this client resolved and is running itself (guest, or a map the
 *  server won't rank). Shaped like the ranked one on purpose: the scene treats
 *  both as a replay of a play that already happened. */
export type LocalPlayContext = {
	mode: 'guest' | 'unranked';
	token: string;
	beatmapId: number;
	offsets: ReplayOffset[];
	startedAt: number;
	endsAt: number;
};

/**
 * How a launched play is scored:
 *  - `guest`    - not signed in: resolved + scored by the local session, awards
 *                 local XP. Runs on its own clock, watched or not.
 *  - `unranked` - signed in but the server hasn't ingested this map: same local
 *                 session, local score only, no XP, not submitted.
 *  - `ranked`   - signed in + map on the server: the server simulated it and is
 *                 authoritative. The client replays the offsets seeked to the
 *                 play's live position (`startedAt`) and fetches the result on
 *                 finish; the server finalises on its own clock regardless.
 *  - `debug`    - dev only: played by the debug bot, no-fail, never
 *                 saved or submitted. Launched from the strain debug view.
 */
export type PlayContext =
	| { mode: 'debug' }
	| LocalPlayContext
	| RankedPlayContext;

/**
 * What a launch resolved to, before anything is running: a ranked play the
 *  server has already started, or the kind of local play to start here.
 *
 * `refused` isn't a way to start a play - the server declined to rank an
 * otherwise-rankable one (anti-cheat lock / server error); the caller turns it
 * into a dialog and, if the player accepts, retries as an `unranked` local play.
 */
export type PlaySession =
	| { mode: 'guest' }
	| { mode: 'unranked' }
	| { mode: 'refused' }
	| RankedPlayContext;

/**
 * The character's server-side play state, pushed over the socket: on connect,
 * on every play start/finish/abort, and live while a state watch is armed.
 * Undefined while disconnected.
 */
export const playState = new Synced<PlayState | undefined>(undefined);
Socket.on('play:state', msg => void playState.set(msg.state));
Socket.on('play:aborted', msg => clearActivePlayState(msg.token));
void Socket.connected.sync(open => {
	if (!open) void playState.set(undefined);
});

/** An aborted play leaves no record and no result: drop the (now stale) active
 *  state so song select doesn't spectate-relaunch it - which would start a
 *  fresh play - or keep showing its banner. */
const clearActivePlayState = (token: string) => {
	const state = playState.get();
	if (state?.phase === 'active' && state.token === token) {
		void playState.set({ phase: 'idle' });
	}
};

/** Decide (and, when ranked, start or join) how a play should be scored. */
export async function startPlaySession(
	character: Character,
	beatmapId: number,
): Promise<PlaySession> {
	if (character.isGuest()) return { mode: 'guest' };
	try {
		const sentAt = Date.now();
		const res = await Socket.request(
			{
				type: 'play:start', beatmapId, xpMultiplier: debugXpMultiplier.get(),
			},
			'play:start',
			START_TIMEOUT_MS,
		);
		const play = res.result;
		if (play.status === 'ranked') {
			// startedAt/endsAt are server-clock ms; the player's clock can differ by
			// seconds. Estimate the server clock at round-trip midpoint and shift the
			// timestamps into our own clock, so anchoring with our Date.now() is exact.
			const skew = (sentAt + Date.now()) / 2 - play.serverNow;
			return {
				mode: 'ranked',
				token: play.token,
				beatmapId: play.beatmapId,
				offsets: play.offsets,
				next: play.next,
				done: play.done,
				startedAt: play.startedAt + skew,
				endsAt: play.endsAt + skew,
			};
		}
		return play.status === 'refused' ? { mode: 'refused' } : { mode: 'unranked' };
	} catch {
		// no connection / timeout: surface it so the player can retry instead of
		// unknowingly playing unranked
		return { mode: 'refused' };
	}
}

/** Thrown by {@link fetchPlayResult} when the server has no result to give,
 *  carrying its reason so the caller can branch (`unknown` = gone server-side). */
export class PlayResultError extends Error {
	constructor(public readonly reason: 'unknown' | 'cache-miss' | 'unfinalized' | 'tooSoon') {
		super(`play result failed (${reason})`);
		this.name = 'PlayResultError';
	}
}

/** Try to get an already finalized play if not already read */
export async function fetchPlayResult(
	token: string,
	forceSee: boolean = false,
) {
	const res = await Socket.request(
		{
			type: 'play:result', token, forceSee,
		},
		'play:result',
		RESULT_TIMEOUT_MS,
		msg => msg.token === token,
	);
	if (!res.result.ok) throw new PlayResultError(res.result.reason);
	// a freshly received score: float its profile movement, wherever we are
	if (res.result.deltas) showDeltas(res.result.deltas);
	return res.result;
}

/** Tell the server the player skipped the lead-in so its timeline moves forward
 *  with the client (otherwise the play finalises late). */
export async function skipPlaySession(token: string) {
	if (!(await Socket.sendSoon({
		type: 'play:skip', token,
	}))) console.warn('[play] skip not delivered');
}

/** Debug: ask the server to end the play now so its authoritative result can be
 *  read immediately. Ignored by a production server. */
export async function finishPlaySession(token: string, next: number) {
	if (!(await Socket.sendSoon({
		type: 'play:finish', token, next,
	}))) console.warn('[play] finish not delivered');
}

/** Quit: tell the server to drop the play without submitting. */
export async function abortPlaySession(token: string) {
	// optimistic: the scene lands back on song select before the server's
	// `play:aborted` returns, and the stale active state must not act there
	clearActivePlayState(token);
	if (!(await Socket.sendSoon({
		type: 'play:abort', token,
	}))) console.warn('[play] abort not delivered');
}
