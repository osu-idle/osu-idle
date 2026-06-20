import { rpc } from './client';
import type Character from '../db/schema/character';
import { ReplayOffset } from '@osu-idle/shared/sim/maniaGame';

/**
 * How a launched play is scored:
 *  - `guest`    - not signed in: simulated + scored locally, awards local XP.
 *  - `unranked` - signed in but the server hasn't ingested this map: played
 *                 locally, local score only, no XP, not submitted.
 *  - `ranked`   - signed in + map on the server: the server simulated it and is
 *                 authoritative. The client replays the offsets seeked to the
 *                 play's live position (`startedAt`) and fetches the result on
 *                 finish; the server finalises on its own clock regardless.
 *  - `debug`    - dev only: played by the debug bot (`makeOrderedSkills`), no-fail, never
 *                 saved or submitted. Launched from the strain debug view.
 */
export type PlayContext =
	| { mode: 'guest' }
	| { mode: 'unranked' }
	| { mode: 'debug' }
	| { mode: 'ranked'; token: string; offsets: ReplayOffset[]; startedAt: number; endsAt: number };

/** A resolved {@link PlayContext}, or `refused` - the server declined to rank an
 *  otherwise-rankable play (anti-cheat lock / server error). `refused` isn't a way
 *  to score a play; the caller turns it into a dialog and, if the player accepts,
 *  retries as an `unranked` local play. */
export type PlaySession = PlayContext | { mode: 'refused' };

/** Decide (and, when ranked, start or join) how a play should be scored. */
export async function startPlaySession(
	character: Character,
	beatmapId: number,
	setId: number,
): Promise<PlaySession> {
	if (character.isGuest()) return { mode: 'guest' };
	try {
		const sentAt = Date.now();
		const res = await rpc.v1.play.start.$post({ json: { beatmapId, setId } });
		// a transport/HTTP failure loses a ranked play silently if we fall back to
		// local - surface it so the player can retry instead of unknowingly playing unranked
		if (!res.ok) return { mode: 'refused' };
		const data = await res.json();
		if (data.ranked) {
			// startedAt/endsAt are server-clock ms; the player's clock can differ by
			// seconds. Estimate the server clock at round-trip midpoint and shift the
			// timestamps into our own clock, so anchoring with our Date.now() is exact.
			const skew = (sentAt + Date.now()) / 2 - data.serverNow;
			return { mode: 'ranked', token: data.token, offsets: data.offsets, startedAt: data.startedAt + skew, endsAt: data.endsAt + skew };
		}
		return data.status === 'refused' ? { mode: 'refused' } : { mode: 'unranked' };
	} catch {
		return { mode: 'refused' };
	}
}

/** What this character is currently playing (for resume / cross-tab spectating),
 *  or null if the server can't be reached. */
export async function getActivePlay() {
	try {
		const res = await rpc.v1.play.state.$get();
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

/** Thrown by {@link fetchPlayResult} on a non-OK response, carrying the HTTP
 *  status so the caller can branch (404 = the result is gone server-side). */
export class PlayResultError extends Error {
	constructor(public readonly status: number) {
		super(`play result failed (${status})`);
		this.name = 'PlayResultError';
	}
}

/** Try to get an already finalized play if not already read */
export async function fetchPlayResult(token: string, forceSee: boolean = false) {
	const res = await rpc.v1.play[':token'].result[':forceSee'].$get({ param: { token, forceSee: forceSee ? 'true' : 'false' } });
	if (!res.ok) {
		throw new PlayResultError(res.status);
	}
	return res.json();
}

/** Tell the server the player skipped the lead-in so its timeline moves forward
 *  with the client (otherwise the play finalises late). */
export async function skipPlaySession(token: string) {
	try {
		await rpc.v1.play[':token'].skip.$post({ param: { token } });
	} catch (e) {
		console.warn('[play] skip failed', e);
	}
}

/** Quit: tell the server to drop the play without submitting. */
export async function abortPlaySession(token: string) {
	try {
		await rpc.v1.play[':token'].abort.$post({ param: { token } });
	} catch (e) {
		console.warn('[play] abort failed', e);
	}
}


/** Quit: tell the server to drop the play without submitting. */
export async function playSessionHeartbeat(token: string) {
	try {
		return (await rpc.v1.play[':token'].heartbeat.$get({ param: { token } })).json();
	} catch (e) {
		console.warn('[play] heartbeat failed', e);
	}
}
