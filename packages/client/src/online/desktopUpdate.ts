import Synced from '@osu-idle/shared/helpers/synced';
import {
	desktop,
	type DesktopUpdateStatus,
} from '@osu-idle/shared/desktop';

/**
 * In-game self-update state for the desktop app. We check the update feed on
 * launch, which drives the {@link DesktopUpdate} UI: the player
 * chooses to download, then restart into the new version.
 *
 * Inert in the browser - `desktop()` is null there, so nothing here runs.
 */
export const updateStatus = new Synced<DesktopUpdateStatus>({ state: 'idle' });

// Subscribe before the first check so a fast result can't broadcast before we're
// listening (the renderer drives the check, so it's always subscribed first).
desktop()?.update.onStatus(status => void updateStatus.set(status));

/** Ask the app whether a newer build is available (no-op in the browser).
 *  Returns the resulting status so callers can keep retrying until the feed
 *  actually offers the build (the installer lags the server version bump). */
export const checkForDesktopUpdate =
	async(): Promise<DesktopUpdateStatus | undefined> => {
		const app = desktop();
		if (!app) return;
		const status = await app.update.check();
		await updateStatus.set(status);
		return status;
	};

export const downloadDesktopUpdate = async () => {
	await desktop()?.update.download();
	desktop()?.update.install();
};

// Check once on launch, independent of the server/client version poll - the app
// may simply be older than what's published, with no live server to compare to.
void checkForDesktopUpdate();