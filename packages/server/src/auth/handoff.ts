import { redis } from '../redis';
import { redisKeyPrefix } from '../env';

/**
 * One-time code handoff for desktop OAuth. The browser callback can't set a
 * cookie the desktop app would see, so it stashes the freshly minted session
 * token under the one-time `poll` code the app generated and put in the OAuth
 * state. The app polls {@link takeHandoff} (via /osu/desktop/exchange) until the
 * token appears, so the long-lived session JWT never travels back through the
 * browser at all. Single-use: the read deletes it.
 */
const HANDOFF_TTL_MS = 60_000;

const handoffKey = (code: string) => `${redisKeyPrefix}authhandoff:${code}`;

/** Stash a session token under the app's one-time poll code, for it to redeem. */
export async function storeHandoff(code: string, token: string): Promise<void> {
	await redis.set(handoffKey(code), token, 'PX', HANDOFF_TTL_MS);
}

/** Redeem a one-time code for its session token, consuming it. Null if the code
 *  is unknown or already used/expired. */
export async function takeHandoff(code: string): Promise<string | null> {
	return redis.getdel(handoffKey(code));
}

const STATE_NONCE_TTL_MS = 60 * 5 * 1000; // matches STATE_TTL

const stateNonceKey = (nonce: string) => `${redisKeyPrefix}authstate:${nonce}`;

/** Claim a one-time OAuth state nonce. Returns true the first time, false on any
 *  replay - the system browser tab can re-fire the callback (reload, back/forward,
 *  prefetch) and osu! revokes the auth code after the first exchange, so a second
 *  attempt would otherwise 500. Lets the callback short-circuit a replay instead. */
export async function claimStateNonce(nonce: string): Promise<boolean> {
	return (await redis.set(stateNonceKey(nonce), '1', 'PX', STATE_NONCE_TTL_MS, 'NX')) === 'OK';
}
