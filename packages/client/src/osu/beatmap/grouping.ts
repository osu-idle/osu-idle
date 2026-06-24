import {
	t,
	plural,
} from '@lingui/core/macro';
import { CarouselItem } from '../../components/BeatmapCarousel';
import { Grades } from '@osu-idle/shared/judgement';

/** Per-character play history, keyed by beatmap (difficulty) id. Mirrors what
 *  SongSelect derives from the local score table; the two history-based group
 *  modes (rank / recency) read from it. */
export interface PlayHistory {
	bestRank: Map<number, number>;   // beatmapId -> best Grades index
	lastPlayed: Map<number, number>; // beatmapId -> most recent playedAt (ms epoch)
}

export const EMPTY_HISTORY: PlayHistory = { 
	bestRank: new Map(), 
	lastPlayed: new Map(), 
};

/** beatmapId -> the local playlists containing that difficulty. Backs the
 *  "By Playlist" group mode; a light shape so this module stays DB-free. */
export type PlaylistsByBeatmap = Map<number, { id: number, name: string }[]>;

export const EMPTY_PLAYLISTS: PlaylistsByBeatmap = new Map();

/** A carousel group: `key` is its stable identity (collapse state, react key),
 *  `label` the header text, `order` its position among groups (ascending). */
export interface Group {
	key: string;
	label: string;
	order: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;
const LAST = 1e9;

/** First-letter bucket: A–Z upper-cased, everything else under '#'. */
function letterGroup(value: string): Group {
	const c = value.trim().charAt(0).toUpperCase();
	const isLetter = c >= 'A' && c <= 'Z';
	return isLetter ? { 
		key: c, 
		label: c, 
		order: c.charCodeAt(0),
	} : { 
		key: '#', 
		label: '#', 
		order: LAST, 
	};
}

/** Length in per-minute bands, collapsing 5–10 min and 10 min+ into one each. */
function lengthGroup(ms: number): Group {
	const min = Math.floor(ms / MINUTE);
	if (min < 5) return { 
		key: `l${min}`, 
		label: t`${min}-${min + 1} min`, 
		order: min,
	};
	if (min < 10) return {
		key: 'l5', label: t`5-10 min`, order: 5, 
	};
	return {
		key: 'l10', label: t`10+ min`, order: 10, 
	};
}

/** Named recency buckets: Today / Yesterday / Last week / N months ago (≈30-day
 *  months) up to "Over 5 months ago", and "Never" for maps with no play */
function recencyGroup(last: number | undefined, now: number): Group {
	if (!last) return {
		key: 'never', label: t`Never`, order: LAST, 
	};
	const days = Math.floor((now - last) / DAY);
	if (days <= 0) return {
		key: 'today', label: t`Today`, order: 0, 
	};
	if (days === 1) return {
		key: 'yesterday', label: t`Yesterday`, order: 1, 
	};
	if (days < 7) return {
		key: 'week', label: t`Last week`, order: 2, 
	};
	const months = Math.max(1, Math.floor(days / 30));
	if (months > 5) return {
		key: 'old', label: t`Over 5 months ago`, order: 99, 
	};
	return { 
		key: `m${months}`, 
		label: plural(months, {
			one: '# month ago', other: '# months ago', 
		}), 
		order: 2 + months, 
	};
}

/**
 * Every group a carousel item falls into for the given group mode. Most modes
 * bucket an item exactly once, but "By Playlist" mirrors osu! collections: a
 * difficulty appears under *each* playlist holding it, and one in no playlist
 * is hidden from the view entirely (empty result).
 */
export function groupsOf(
	item: CarouselItem, mode: string, history: PlayHistory, now: number,
	playlists: PlaylistsByBeatmap, downloaded?: ReadonlySet<number>,
): Group[] {
	if (mode === 'By Playlist') {
		// all order 0: playlists render alphabetically via the label tiebreak
		return (playlists.get(item.beatmap.metadata.id) ?? [])
			.map((p) => ({
				key: `p${p.id}`, label: p.name, order: 0, 
			}));
	}
	const g = groupOf(item, mode, history, now, downloaded);
	return g ? [g] : [];
}

/**
 * The group a carousel item falls into for the given group mode, or `null` for
 * "No Grouping". Groups are rendered in ascending `order`; items within a group
 * keep the active sort order.
 */
export function groupOf(
	item: CarouselItem, mode: string, history: PlayHistory, now: number, downloaded?: ReadonlySet<number>,
): Group | null {
	const bm = item.beatmap.metadata;
	const set = item.set.metadata;
	switch (mode) {
		case 'By Artist': return letterGroup(set.artist);
		case 'By Title': return letterGroup(set.title);
		case 'By Creator': return letterGroup(set.creator);
		case 'By Difficulty': {
			const n = Math.floor(bm.difficulty);
			return {
				key: `d${n}`, label: `${n} - ${n + 1}★`, order: n, 
			};
		}
		case 'By BPM': {
			const lo = Math.floor(bm.bpm / 10) * 10;
			return {
				key: `b${lo}`, label: `${lo} - ${lo + 10} BPM`, order: lo, 
			};
		}
		case 'By Length': return lengthGroup(bm.total_length);
		case 'By Download Status': {
			// `downloaded` is a frozen snapshot when present, so a map downloaded
			// mid-session keeps showing under "Available" instead of jumping groups
			// (which would drag the selection along). Live `runtime` before it's set.
			const has = downloaded ? downloaded.has(bm.id) : bm.runtime;
			return has
				? {
					key: 'downloaded', label: t`Downloaded`, order: 0, 
				}
				: {
					key: 'available', label: t`Available`, order: 1, 
				};
		}
		case 'By Rank Achieved': {
			const rank = history.bestRank.get(bm.id);
			if (rank === undefined) return {
				key: 'unplayed', 
				label: t`Unplayed`,
				order: LAST, 
			};
			return {
				key: Grades[rank], label: Grades[rank], order: rank, 
			};
		}
		case 'Recently Played': return recencyGroup(history.lastPlayed.get(bm.id), now);
		default: return null;
	}
}
