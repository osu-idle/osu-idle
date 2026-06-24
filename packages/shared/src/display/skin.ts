import {
	__,
	defineMessages,
} from '../i18n/translate.js';
import {
	SKIN_STATUS,
	type SkinStatus,
} from '../skin.js';

// Player-facing labels for the add-on moderation states, kept apart from the
// status keys the server/UI branch on (addon.ts owns those).
const STATUS_LABELS = defineMessages({
	[SKIN_STATUS.UNPUBLISHED]: 'Unpublished',
	[SKIN_STATUS.PUBLISHED]: 'Published',
} satisfies Record<SkinStatus, string>);

/** The localized label of an add-on's moderation status. */
export const skinStatusLabel = (
	status: SkinStatus,
): string => __(STATUS_LABELS[status]);
