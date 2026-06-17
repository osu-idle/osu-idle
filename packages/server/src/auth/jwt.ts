import { sign, verify } from 'hono/jwt';
import { env } from '../env';

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days, seconds
const STATE_TTL = 60 * 5; // 5 minutes, seconds

export interface SessionPayload {
	uid: number;
	username: string;
}

const now = () => Math.floor(Date.now() / 1000);

/** Sign our session JWT (stored in the HttpOnly cookie). */
export function signSession(user: { id: number; username: string }): Promise<string> {
	return sign({ uid: user.id, username: user.username, iat: now(), exp: now() + SESSION_TTL }, env.JWT_SECRET);
}

/** Verify the session JWT; throws if invalid or expired. */
export async function verifySession(token: string): Promise<SessionPayload> {
	const payload = await verify(token, env.JWT_SECRET, 'HS256');
	return { uid: payload.uid as number, username: payload.username as string };
}

/** Short-lived signed CSRF state for the OAuth round-trip. */
export function signState(): Promise<string> {
	return sign({ nonce: crypto.randomUUID(), iat: now(), exp: now() + STATE_TTL }, env.JWT_SECRET);
}

/** Verify the CSRF state; throws if invalid or expired. */
export async function verifyState(state: string): Promise<void> {
	await verify(state, env.JWT_SECRET, 'HS256');
}
