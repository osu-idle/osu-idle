import { SETTINGS } from '../db/settings';

/**
 * Enter/leave document fullscreen to match the setting. Must be called from
 * within a user gesture (e.g. the options checkbox click) - browsers reject
 * `requestFullscreen` otherwise, which is also why we never auto-apply a
 * persisted `true` on boot.
 */
export function applyFullscreen(on: boolean): void {
	if (on && !document.fullscreenElement) {
		void document.documentElement.requestFullscreen?.().catch(() => { /* denied */ });
	} else if (!on && document.fullscreenElement) {
		void document.exitFullscreen?.().catch(() => { /* ignore */ });
	}
}

/**
 * Keep the setting truthful when fullscreen changes outside the panel (the user
 * pressing Esc or F11), so the checkbox always reflects the real state.
 */
export function initFullscreen(): void {
	document.addEventListener('fullscreenchange', () => {
		void SETTINGS.fullscreen.set(!!document.fullscreenElement);
	});
}
