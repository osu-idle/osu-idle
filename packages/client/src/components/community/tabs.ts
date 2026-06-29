import {
	mapped,
	type ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import type { PresenceEntry } from '@osu-idle/shared/community/presence';

/** The body tabs. The first four sort the player grid; `map` swaps to the world map. */
export const TAB = mapped(['name', 'rank', 'location', 'timezone', 'map']);
export type Tab = ValueIn<typeof TAB>;

const byName = (a: PresenceEntry, b: PresenceEntry) => a.name.localeCompare(b.name);

/** Order the roster for a sort tab (a no-op for the map tab). */
export const sortCharacters = (characters: PresenceEntry[], tab: Tab): PresenceEntry[] => {
	const sorted = [...characters];
	switch (tab) {
		case 'rank':
			return sorted.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || byName(a, b));
		case 'location':
			return sorted.sort((a, b) => a.country.localeCompare(b.country) || byName(a, b));
		case 'timezone':
			return sorted.sort((a, b) => (a.tz ?? '').localeCompare(b.tz ?? '') || byName(a, b));
		default:
			return sorted.sort(byName);
	}
};
