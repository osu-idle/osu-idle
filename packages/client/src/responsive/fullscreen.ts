import { SETTINGS } from '../db/settings';
import { desktop } from '@osu-idle/shared/desktop';

/**
 * Enter/leave fullscreen to match the setting.
 *  - desktop (Electron): native window fullscreen, which needs no user gesture.
 *  - browser: the DOM Fullscreen API, which browsers only allow from within a
 *    user gesture (e.g. the options checkbox click) - which is also why the
 *    browser never auto-applies a persisted `true` on boot.
 */
export function applyFullscreen(on: boolean): void {
	const app = desktop();
	if (app) {
		app.setFullscreen(on);
		return;
	}
	if (on && !document.fullscreenElement) {
		void document.documentElement.requestFullscreen?.()
			.catch(() => { /* denied */ });
	} else if (!on && document.fullscreenElement) {
		void document.exitFullscreen?.().catch(() => { /* ignore */ });
	}
}

/**
 * Keep the setting truthful when fullscreen changes outside the panel
 * so the checkbox always reflects the real state. On desktop we also apply the
 * persisted setting on boot (Electron allows it without a gesture).
 */
export function initFullscreen(): void {
	const app = desktop();
	if (app) {
		app.onFullscreenChanged(on => void SETTINGS.fullscreen.set(on));
		app.setFullscreen(SETTINGS.fullscreen.get());
		return;
	}
	document.addEventListener('fullscreenchange', () => {
		void SETTINGS.fullscreen.set(!!document.fullscreenElement);
	});
}
