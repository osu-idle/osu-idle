import { hc } from 'hono/client';
import type { ClientResponse } from 'hono/client';
import type { AppType } from '@osu-idle/server';
import { desktop } from '@osu-idle/shared/desktop';

/** API origin; empty in dev so requests go through the Vite proxy. */
export const API_URL = import.meta.env.VITE_API_URL ?? '';

/** Resolve an API path (e.g. /v1/news) or stored media path to a full URL. */
export const apiUrl = (path: string): string =>
	/^https?:\/\//.test(path) ? path : `${API_URL}${path}`;

/**
 * Apply the live session auth, mirroring the game client: the browser rides the
 * HttpOnly cookie (`credentials: 'include'`), while the desktop app - loaded from
 * an `app://` origin the cookie can't reach - sends its held token as a `Bearer`
 * header instead. Same session JWT either way.
 */
export function withAuth(init?: RequestInit): RequestInit {
	const token = desktop()?.getToken();
	if (!token) return { ...init, credentials: 'include' };
	const headers = new Headers(init?.headers);
	headers.set('Authorization', `Bearer ${token}`);
	return { ...init, headers, credentials: 'omit' };
}

/** Parse a JSON response, throwing the server's error message on failure. */
export async function json<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({})) as { error?: string };
		throw new Error(body.error ?? `Request failed (${res.status})`);
	}
	return res.json() as Promise<T>;
}

/** Send a credentialed request to an API path; JSON-encodes a body when given. */
export const send = (method: string, path: string, body?: unknown): Promise<Response> =>
	fetch(apiUrl(path), withAuth({
		method,
		headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	}));

/** Send a request and parse the JSON response in one step. */
export const request = <T>(method: string, path: string, body?: unknown): Promise<T> =>
	send(method, path, body).then(json<T>);

/**
 * Typed RPC client generated from the server's `AppType` - every route, its
 * params, and its return type are inferred from the server, so there are no
 * hand-written client types to keep in sync. Mirrors the game client's
 * `online/client.ts`; `AppType` is a type-only import, so no server runtime is
 * bundled.
 */
export const rpc = hc<AppType>(API_URL, {
	fetch: (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, withAuth(init)),
});

/** Await a typed RPC response, throwing the server's error message on failure. */
export async function unwrap<T>(p: Promise<ClientResponse<T>>): Promise<T> {
	return p.then(json<T>);
}
