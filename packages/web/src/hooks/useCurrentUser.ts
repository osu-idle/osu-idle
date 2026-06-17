import { useSyncExternalStore } from 'react';
import type { UserDTO } from '@osu-idle/shared/user';

const API_URL = import.meta.env.VITE_API_URL ?? '';

// Module-level cache shared by every consumer: the session is fetched once and
// the result fanned out to all hook instances, rather than each mount firing
// its own /auth/me.
let user: UserDTO | null = null;
let loaded = false;
let inFlight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function load(): Promise<void> {
	inFlight ??= fetch(`${API_URL}/v1/auth/me`, { credentials: 'include' })
		.then(res => (res.ok ? res.json() : null))
		.then((data: UserDTO | null) => { user = data ?? null; })
		.catch(() => { user = null; })
		.finally(() => {
			loaded = true;
			inFlight = null;
			subscribers.forEach(fn => fn());
		});
	return inFlight;
}

/** Force a re-fetch of the session (e.g. right after sign-in or sign-out). */
export function refreshCurrentUser(): Promise<void> {
	loaded = false;
	inFlight = null;
	return load();
}

// The auth popup pings localStorage on success (see AuthCallback); refresh when
// that fires so the opener reflects the new session without a reload.
if (typeof window !== 'undefined') {
	window.addEventListener('storage', e => {
		if (e.key === 'osu-idle:auth') void refreshCurrentUser();
	});
}

function subscribe(cb: () => void): () => void {
	subscribers.add(cb);
	if (!loaded) void load();
	return () => { subscribers.delete(cb); };
}

const getUser = () => user;
const getLoaded = () => loaded;

/** The signed-in account (cookie-authenticated), or null when signed out.
 *  Backed by a single shared `/auth/me` request, deduped across all callers. */
export function useCurrentUser(): UserDTO | null {
	return useSyncExternalStore(subscribe, getUser, getUser);
}

/** Whether the session has been resolved yet - false until the first
 *  `/auth/me` settles. Use to avoid rendering a signed-out UI before we know. */
export function useAuthLoaded(): boolean {
	return useSyncExternalStore(subscribe, getLoaded, getLoaded);
}
