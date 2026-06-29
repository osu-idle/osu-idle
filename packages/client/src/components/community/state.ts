import Synced from '@osu-idle/shared/helpers/synced';
import {
	mapped,
	type ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import { Setting } from '../../db/settings';
import {
	TAB,
	type Tab,
} from './tabs';

export const showUsers = new Synced(false);
export const showChat = new Synced(false);
export const showTicker = new Setting('community.showTicker', true);
export const autoHide = new Setting('community.autoHide', false);

/** How the roster is narrowed. `friends` is reserved (disabled for now). */
export const FILTER = mapped(['all', 'friends', 'country']);
export type Filter = ValueIn<typeof FILTER>;

/** Transient view state, shared so the header and body stay in sync. */
export const activeTab = new Synced<Tab | undefined>(TAB.name);
export const activeFilter = new Synced<Filter>(FILTER.all);
export const searchQuery = new Synced('');

