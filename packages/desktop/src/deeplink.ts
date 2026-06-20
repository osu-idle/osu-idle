import { DESKTOP_SCHEME } from './config';

/**
 * Custom-scheme (`osu-idle://<action>?<params>`) deep-link entry point. The OS
 * routes these to the running app, which is registered as the protocol client and
 * single-instanced so a link always reaches the live window (see main.ts), which
 * also brings the window forward for every link.
 *
 * The only action wired so far is `focus` - the post-sign-in "Return to osu!idle"
 * button, whose whole job is that refocus (so there's nothing to do here). It's
 * also the hook future app-directed links dispatch through (e.g. focusing a map
 * opened from the web platform): match on `url.host` and forward to the renderer.
 */
export function handleDeepLink(rawUrl: string): void {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return;
	}
	if (url.protocol !== `${DESKTOP_SCHEME}:`) return;

	switch (url.host) {
		case 'focus':
			return; // window focus is handled by the caller (main.ts)
		default:
			console.warn(`[deeplink] no handler for action "${url.host}"`, rawUrl);
	}
}
