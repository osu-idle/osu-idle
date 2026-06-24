import Synced from '@osu-idle/shared/helpers/synced';
import { VERSION } from '@osu-idle/shared/version';
import { desktop } from '@osu-idle/shared/desktop';
import { getVersion } from './online/services/stats';
import { checkForDesktopUpdate } from './online/desktopUpdate';
import Log, { POPUP_TYPE } from '@osu-idle/shared/helpers/log';
import { t } from '@lingui/core/macro';
import { ScoreDTO } from '@osu-idle/shared/score';
import { Score } from './db/schema/score';

export const debugMode = new Synced(import.meta.env.DEV);

// True on touch-primary devices (phones/tablets): coarse pointer + no hover.
export const isMobile = window.matchMedia('(pointer: coarse) and (hover: none)').matches;

export const isStandalone = new Synced(!!desktop());

export const isWebOpen = new Synced(false);
export const isOptionsOpen = new Synced(false);
export const webUrl = new Synced('/');

export const isVolumeVisible = new Synced(false);

export const message = new Synced('');

export const currentScore = new Synced<Score | ScoreDTO | undefined>(undefined);

let lastVersion = VERSION;
let awaitingUpdate = false;
let lock = false;
setInterval(async () => {
	const currentVersion = await getVersion();
	if (currentVersion !== lastVersion) {
		lastVersion = currentVersion;
		if (desktop()) {
			awaitingUpdate = currentVersion !== VERSION;
		} else {
			Log.popup(
				t`Version ${currentVersion} is available ! Refresh the page to update.`, 
				POPUP_TYPE.neutral, true);
		}
	}
	if (awaitingUpdate && !lock) {
		lock = true;
		const status = await checkForDesktopUpdate();
		if (status && status.state !== 'none' && status.state !== 'checking') {
			awaitingUpdate = false;
			Log.popup(
				t`Version ${currentVersion} is available ! Update in the main menu.`, 
				POPUP_TYPE.neutral, true);
		}
		lock = false;
	}
}, 1000);