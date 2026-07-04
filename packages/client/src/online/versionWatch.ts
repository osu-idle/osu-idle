import { VERSION } from '@osu-idle/shared/version';
import { desktop } from '@osu-idle/shared/desktop';
import Log, { POPUP_TYPE } from '@osu-idle/shared/helpers/log';
import { t } from '@lingui/core/macro';
import Socket from './socket';
import { checkForDesktopUpdate } from './desktopUpdate';

// The server pushes its version over the socket on every (re)connect. A bump
// only ships by restarting the server, and the deploy restarts it only once the
// desktop installer is already published - so a reconnect carrying a newer
// version means the update is ready to grab: web refreshes, desktop pulls it.
// Synced dedupes on the string, so repeated reconnects don't re-announce.

const announce = async (version: string) => {
	if (version === VERSION) return;
	if (!desktop()) {
		Log.popup(
			t`Version ${version} is available ! Refresh the page to update.`,
			POPUP_TYPE.neutral, true);
		return;
	}
	const status = await checkForDesktopUpdate();
	if (status && status.state !== 'none' && status.state !== 'checking') {
		Log.popup(
			t`Version ${version} is available ! Update in the main menu.`,
			POPUP_TYPE.neutral, true);
	}
};

Socket.serverVersion.sync(version => void announce(version));
