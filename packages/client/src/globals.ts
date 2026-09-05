import Synced from '@osu-idle/shared/helpers/synced';
import { desktop } from '@osu-idle/shared/desktop';
import { ScoreDTO } from '@osu-idle/shared/score';
import type { PlayDeltas } from '@osu-idle/shared/play';
import { Score } from './db/schema/score';

export const debugMode = new Synced(import.meta.env.DEV);

/** Debug: scales the xp a play awards, so the long progression thresholds are
 *  reachable while testing. The server refuses it outside development. */
export const DEBUG_XP_STEPS = [1, 10, 100, 1000, 10000, 100000] as const;
export const debugXpMultiplier = new Synced<number>(1);

// True on touch-primary devices (phones/tablets): coarse pointer + no hover.
export const isMobile = window.matchMedia('(pointer: coarse) and (hover: none)').matches;

export const isStandalone = new Synced(!!desktop());

export const isWebOpen = new Synced(false);
export const isOptionsOpen = new Synced(false);
export const isCommunityOpen = new Synced(false);
export const webUrl = new Synced('/');

/** The full-screen page overlay (skins / add-ons / character); undefined = closed. */
export type OpenPage =
	| {
		page: 'skins' | 'addons',
		view: 'manage' | 'browse',
	}
	| { page: 'character' };
export const openPage = new Synced<OpenPage | undefined>(undefined);

export const isVolumeVisible = new Synced(false);
export const displayAlpha = new Synced(false);

export const message = new Synced('');

export const currentScore = new Synced<Score | ScoreDTO | undefined>(undefined);

/** The latest ranked score's profile movement, floated app-wide by
 *  FloatingDeltas; `at` keys each showing so a new score restarts the
 *  animation. */
export const playDeltas = new Synced<{ deltas: PlayDeltas; at: number } | undefined>(undefined);

export const showDeltas = (deltas: PlayDeltas): void => {
	if (!deltas.rank && !deltas.rankedScore && !deltas.pp) return;
	void playDeltas.set({
		deltas, at: Date.now(),
	});
};