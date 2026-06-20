import { contextBridge, ipcRenderer } from 'electron';
// shared is ESM and this preload compiles to CommonJS; the resolution-mode hint
// lets the type-only import resolve without making the whole package ESM (an
// ESM preload has extra Electron caveats we don't need on the auth path).
import type { DesktopPresence, DesktopUpdateStatus, OsuIdleDesktop } from '@osu-idle/shared/desktop' with { 'resolution-mode': 'import' };

/**
 * Runs in every frame (top window + the same-origin /web iframe). Exposes the
 * typed {@link OsuIdleDesktop} bridge the renderer feature-detects via
 * `@osu-idle/shared/desktop`. The session token is seeded synchronously so the
 * very first API call already carries it, then kept live via a push from main.
 */

const boot = ipcRenderer.sendSync('osu-idle:bootstrap') as { token: string | null; version: string };

let token: string | null = boot.token;
const listeners = new Set<(token: string | null) => void>();

ipcRenderer.on('osu-idle:auth-token', (_event, next: string | null) => {
	token = next;
	for (const cb of listeners) {
		try { cb(token); } catch (e) { console.error('[desktop] auth listener threw', e); }
	}
});

const updateListeners = new Set<(status: DesktopUpdateStatus) => void>();
ipcRenderer.on('osu-idle:update-status', (_event, status: DesktopUpdateStatus) => {
	for (const cb of updateListeners) {
		try { cb(status); } catch (e) { console.error('[desktop] update listener threw', e); }
	}
});

const fullscreenListeners = new Set<(on: boolean) => void>();
ipcRenderer.on('osu-idle:fullscreen', (_event, on: boolean) => {
	for (const cb of fullscreenListeners) {
		try { cb(on); } catch (e) { console.error('[desktop] fullscreen listener threw', e); }
	}
});

const bridge: OsuIdleDesktop = {
	isDesktop: true,
	version: boot.version,
	getToken: () => token,
	login: () => ipcRenderer.invoke('osu-idle:login'),
	logout: () => ipcRenderer.invoke('osu-idle:logout'),
	onAuthChanged: cb => {
		listeners.add(cb);
		return () => { listeners.delete(cb); };
	},
	setFullscreen: on => ipcRenderer.send('osu-idle:set-fullscreen', on),
	setPresence: (presence: DesktopPresence | null) => ipcRenderer.send('osu-idle:presence', presence),
	quit: () => ipcRenderer.send('osu-idle:quit'),
	onFullscreenChanged: cb => {
		fullscreenListeners.add(cb);
		return () => { fullscreenListeners.delete(cb); };
	},
	update: {
		check: () => ipcRenderer.invoke('osu-idle:update-check'),
		download: () => ipcRenderer.invoke('osu-idle:update-download'),
		install: () => ipcRenderer.send('osu-idle:update-install'),
		onStatus: cb => {
			updateListeners.add(cb);
			return () => { updateListeners.delete(cb); };
		},
	},
	steam: { available: false },
};

contextBridge.exposeInMainWorld('osuIdleDesktop', bridge);
