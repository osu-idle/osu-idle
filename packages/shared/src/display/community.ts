import {
	__,
	defineMessages,
} from '../i18n/translate.js';
import type { Status } from '../community/presence.js';

const STATUS_NAMES = defineMessages({
	idle: 'Idle',
	afk: 'AFK',
	playing: 'Playing',
} satisfies Record<Status, string>);

/** The player-facing, localized label for a presence status. */
export function statusName(status: Status): string {
	return __(STATUS_NAMES[status]);
}
