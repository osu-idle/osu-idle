import { app } from 'electron';
// electron-updater is CommonJS and exposes `autoUpdater` as a *named* export (no
// default), so import it by name - a default import resolves to `undefined`.
import { autoUpdater } from 'electron-updater';
// eslint-disable-next-line @stylistic/max-len
import type { DesktopUpdateStatus } from '@osu-idle/shared/desktop' with { 'resolution-mode': 'import' };
import { broadcast } from './frames';

/**
 * In-app self-update. The feed (provider/url) is read from the `app-update.yml`
 * electron-builder bundles from the `publish` config, so packaged builds know
 * where to look with no extra wiring. User-initiated: the renderer checks when it
 * learns a newer build shipped (the client already polls the server version),
 * then chooses to download and restart.
 */

let status: DesktopUpdateStatus = { state: 'idle' };

function emit(next: DesktopUpdateStatus): void {
	status = next;
	broadcast('osu-idle:update-status', status);
}

export function getUpdateStatus(): DesktopUpdateStatus {
	return status;
}

/** Wire the updater's events to status broadcasts. Call once, after ready. */
export function initUpdater(): void {
	autoUpdater.autoDownload = false;          // wait for the user to choose
	autoUpdater.autoInstallOnAppQuit = true;   // apply a fetched update on next quit
	// shipped versions carry a `-buildNNNN` prerelease tag, so build→build updates
	// are prerelease→prerelease - electron-updater needs this to offer them.
	autoUpdater.allowPrerelease = true;
	// surface the updater's own diagnostics (feed URL, versions compared, errors)
	// to the main-process console - run the app from a terminal to see them.
	autoUpdater.logger = {
		info: (m: unknown) => console.log('[updater]', m),
		warn: (m: unknown) => console.warn('[updater]', m),
		error: (m: unknown) => console.error('[updater]', m),
		debug: (m: unknown) => console.debug('[updater]', m),
	};

	autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }));
	autoUpdater.on('update-available', info => emit({
		state: 'available', version: info.version, 
	}));
	autoUpdater.on('update-not-available', () => emit({ state: 'none' }));
	autoUpdater.on('download-progress', p => emit({
		state: 'downloading', percent: Math.round(p.percent), 
	}));
	autoUpdater.on('error', err => emit({
		state: 'error', message: err?.message ?? String(err), 
	}));
}

/** The updater only works in a packaged build - it reads app-update.yml and
 *  swaps the installed app. In dev there's nothing to update. */
function unavailable(): boolean {
	return !app.isPackaged;
}

export async function checkForUpdate(): Promise<DesktopUpdateStatus> {
	if (unavailable()) return { state: 'none' };
	try {
		await autoUpdater.checkForUpdates();
	} catch (e) {
		emit({
			state: 'error', message: e instanceof Error ? e.message : String(e), 
		});
	}
	return status;
}

export async function downloadUpdate(): Promise<void> {
	if (unavailable()) return;
	try {
		await autoUpdater.downloadUpdate();
	} catch (e) {
		emit({
			state: 'error', message: e instanceof Error ? e.message : String(e), 
		});
	}
}

export function installUpdate(): void {
	if (unavailable()) return;
	autoUpdater.quitAndInstall();
}
