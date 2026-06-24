import {
	__,
	defineMessages,
} from '../i18n/translate.js';
import {
	ADDON_STATUS,
	type AddonStatus,
} from '../addon.js';

// Player-facing labels for the add-on moderation states, kept apart from the
// status keys the server/UI branch on (addon.ts owns those).
const STATUS_LABELS = defineMessages({
	[ADDON_STATUS.unpublished]: 'Unpublished',
	[ADDON_STATUS.pending]: 'Pending',
	[ADDON_STATUS.onHold]: 'On Hold',
	[ADDON_STATUS.denied]: 'Denied',
	[ADDON_STATUS.published]: 'Published',
} satisfies Record<AddonStatus, string>);

/** The localized label of an add-on's moderation status. */
export const addonStatusLabel = (
	status: AddonStatus,
): string => __(STATUS_LABELS[status]);
