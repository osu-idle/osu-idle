import Synced from '@osu-idle/shared/helpers/synced';
import type { ValueIn } from '@osu-idle/shared/helpers/mapped';

/**
 * Client-side feature unlocks, seeded for a future upgrade system: each entry
 * is a tier (0 = locked), so a feature can be toggled off and improved by
 * upgrades. Until upgrades land, features default to their base unlocked tier.
 */

export const XP_INSIGHT_TIER = {
	LOCKED: 0,
	/** indicators from stored previous plays' gains */
	HISTORY: 1,
	/** (future) precise indicators from simulating the play up front */
	SIMULATION: 2,
} as const;
export type XPInsightTier = ValueIn<typeof XP_INSIGHT_TIER>;

export const UNLOCKS = {
	/** song-select XP gain indicators */
	xpInsight: new Synced<XPInsightTier>(XP_INSIGHT_TIER.HISTORY),
};
