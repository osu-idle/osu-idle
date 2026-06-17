import type { ReplayOffsetDTO } from '@osu-idle/shared/play';
import { rpc } from './client';
import type Character from '../db/schema/character';

/**
 * How a launched play is scored:
 *  - `guest`    - not signed in: simulated + scored locally, awards local XP.
 *  - `unranked` - signed in but the server hasn't ingested this map: played
 *                 locally, local score only, no XP, not submitted.
 *  - `ranked`   - signed in + map on the server: the server already simulated it;
 *                 the client replays the returned offsets and submits on finish.
 *  - `debug`    - dev only: played by the debug bot (`makeOrderedSkills`), no-fail, never
 *                 saved or submitted. Launched from the strain debug view.
 */
export type PlayContext =
	| { mode: 'guest' }
	| { mode: 'unranked' }
	| { mode: 'debug' }
	| { mode: 'ranked'; token: string; offsets: ReplayOffsetDTO[] };

/** A resolved {@link PlayContext}, or `refused` - the server declined to rank an
 *  otherwise-rankable play (anti-cheat lock / server error). `refused` isn't a way
 *  to score a play; the caller turns it into a dialog and, if the player accepts,
 *  retries as an `unranked` local play. */
export type PlaySession = PlayContext | { mode: 'refused' };

/** Decide (and, when ranked, kick off) how a play should be scored. */
export async function startPlaySession(
	character: Character,
	beatmapId: number,
	setId: number,
): Promise<PlaySession> {
	if (character.isGuest()) return { mode: 'guest' };
	try {
		const res = await rpc.v1.me.play.$post({ json: { beatmapId, setId } });
		// a transport/HTTP failure loses a ranked play silently if we fall back to
		// local - surface it so the player can retry instead of unknowingly playing unranked
		if (!res.ok) return { mode: 'refused' };
		const data = await res.json();
		if (data.ranked) return { mode: 'ranked', token: data.token, offsets: data.offsets };
		return data.reason === 'refused' ? { mode: 'refused' } : { mode: 'unranked' };
	} catch {
		return { mode: 'refused' };
	}
}

/** Signal the server that a ranked play finished and get the persisted result. */
export async function completePlaySession(token: string, abort: boolean = false) {
	const res = await rpc.v1.me.play[':token'].complete[':abort'].$post({ param: { token, abort: abort ? '1' : '0' } });
	if (!res.ok) throw new Error(`play completion failed (${res.status})`);
	return res.json();
}
