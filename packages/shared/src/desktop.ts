/** Lifecycle of a self-update, pushed to the renderer as it progresses. */
export type DesktopUpdateStatus =
	| { state: 'idle' }
	| { state: 'checking' }
	| { state: 'available'; version: string }
	| { state: 'none' }
	| { state: 'downloading'; percent: number }
	| { state: 'error'; message: string };

/** A Discord Rich Presence snapshot the renderer pushes to the desktop shell.
 *  Desktop-only: ignored in a browser, and a no-op unless the app was built with
 *  a Discord client id and Discord is actually running. */
export interface DesktopPresence {
	/** First line in Discord - the activity (a scene label, or "Playing"). */
	details: string;
	/** Second line - usually the map as "artist - title [version]". */
	state?: string;
	smallImage?: string;
	/** Epoch ms the activity began; drives Discord's "elapsed" timer. */
	startedAt?: number;
}

/** In-app self-update (electron-updater under the hood). User-initiated: the
 *  renderer checks when it learns a newer build shipped, then offers to download
 *  and restart. No-ops in an unpackaged/dev build. */
export interface DesktopUpdater {
	/** Ask the update feed whether a newer build exists; resolves to the outcome. */
	check(): Promise<DesktopUpdateStatus>;
	/** Download the available update (progress arrives via {@link onStatus}). */
	download(): Promise<void>;
	/** Quit and install a downloaded update (relaunches into the new version). */
	install(): void;
	/** Subscribe to update lifecycle/progress; returns an unsubscribe fn. */
	onStatus(cb: (status: DesktopUpdateStatus) => void): () => void;
}

/**
 * The bridge the Electron app injects on `window.osuIdleDesktop` (via its
 * preload, in every frame). Absent in a normal browser - {@link desktop} returns
 * null there, so all desktop-specific behaviour is opt-in and the web build is
 * unaffected. The desktop preload implements this exact shape.
 */
export interface OsuIdleDesktop {
	readonly isDesktop: true;
	readonly version: string;
	/** In-app self-update controls. */
	readonly update: DesktopUpdater;
	/** Current session token to send as a Bearer header, or null when signed out.
	 *  Synchronous and cached - safe to read per request. */
	getToken(): string | null;
	/** Begin osu! sign-in: opens the system browser to the OAuth flow. Resolves
	 *  once the round-trip completes (token stored) or rejects on failure/cancel. */
	login(): Promise<void>;
	/** Forget the stored session token (sign out). */
	logout(): Promise<void>;
	/** Subscribe to token changes (login / logout); returns an unsubscribe fn. */
	onAuthChanged(cb: (token: string | null) => void): () => void;
	/** Native window fullscreen - unlike the browser Fullscreen API it needs no
	 *  user gesture, so the persisted setting can be applied on boot. */
	setFullscreen(on: boolean): void;
	/** Subscribe to window fullscreen changes (F11 / OS), so the setting stays
	 *  truthful; returns an unsubscribe fn. */
	onFullscreenChanged(cb: (fullscreen: boolean) => void): () => void;
	/** Discord Rich Presence: reflect the current scene / playing map. Pass null
	 *  to clear. No-op when Discord isn't running or no client id was built in. */
	setPresence(presence: DesktopPresence | null): void;
	/** Quit the desktop app immediately. The browser `window.close()` lingers in
	 *  Electron, so the renderer calls this for a snappy exit. No-op in a browser. */
	quit(): void;
	/** Steam integration - inert until wired up, exposed so callers can feature-detect. */
	readonly steam: { readonly available: boolean };
}

declare global {
	interface Window {
		osuIdleDesktop?: OsuIdleDesktop;
	}
}

/** The desktop bridge when running inside the Electron app, otherwise null. */
export function desktop(): OsuIdleDesktop | null {
	return typeof window !== 'undefined' && window.osuIdleDesktop ? window.osuIdleDesktop : null;
}
