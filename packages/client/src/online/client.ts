import { hc } from 'hono/client';
import type { AppType } from '@osu-idle/server';
import API from './api';

export const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Typed RPC client generated from the server's `AppType`. Every route, its
 * params, and its return type are inferred from the server's route
 * definitions - there are no hand-written client types to keep in sync.
 *
 * Requests are routed through {@link API.fetch} so they keep the shared
 * retry/backoff (and, later, auth headers).
 */
export const rpc = hc<AppType>(BASE_URL, {
	// `credentials: 'include'` sends the session cookie on cross-origin API calls.
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		API.fetch(input, { ...init, credentials: 'include' }),
});
