import Synced from '@osu-idle/shared/helpers/synced';
import { VERSION } from '@osu-idle/shared/version';
import { getVersion } from './online/services/stats';
import Log, { POPUP_TYPE } from '@osu-idle/shared/helpers/log';
import { t } from '@lingui/core/macro';

export const debugMode = new Synced(import.meta.env.DEV);

// True on touch-primary devices (phones/tablets): coarse pointer + no hover.
export const isMobile = window.matchMedia('(pointer: coarse) and (hover: none)').matches;

export const isWebOpen = new Synced(false);
export const isOptionsOpen = new Synced(false);
export const webUrl = new Synced('/');

export const isVolumeVisible = new Synced(false);

export const message = new Synced('');

let lastVersion = VERSION;
setInterval(async () => {
	const currentVersion = await getVersion();
	if (lastVersion !== currentVersion) {
		Log.popup(t`Version ${currentVersion} is available ! Refresh the page to update.`, POPUP_TYPE.neutral, true);
		lastVersion = currentVersion;
	}
}, 1000);