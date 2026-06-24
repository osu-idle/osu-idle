import { hc } from 'hono/client';
import type { AppType } from '@osu-idle/server';
import { desktop } from '@osu-idle/shared/desktop';
import API from './api';

export const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Apply the live session auth to an outgoing API request:
 *  - browser: the session is an HttpOnly cookie, sent via `credentials: 'include'`.
 *  - desktop: the app loads from an `app://` origin the API cookie can't ride, so
 *    it holds the token itself and sends it as a `Bearer` header (no cookie).
 */
export function withAuth(init?: RequestInit): RequestInit {
	const token = desktop()?.getToken();
	if (!token) return {
		...init, credentials: 'include', 
	};
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);
	return {
		...init, headers, credentials: 'omit', 
	};
}

/**
 * Typed RPC client generated from the server's `AppType`. Every route, its
 * params, and its return type are inferred from the server's route
 * definitions - there are no hand-written client types to keep in sync.
 *
 * Requests are routed through {@link API.fetch} so they keep the shared
 * retry/backoff, and through {@link withAuth} for the cookie/Bearer session.
 */
export const rpc = hc<AppType>(BASE_URL, {
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		API.fetch(input, withAuth(init)),
});
