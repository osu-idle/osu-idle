import type { z } from 'zod';
import { characterNameBody } from './onboarding.js';

/** Suffix a displaced character name takes, osu!-style. Chains indefinitely:
 *  Adri -> Adri_old -> Adri_old_old. */
export const OLD_SUFFIX = '_old';

/**
 * Unlocks granted one per rebirth, in order: a character of generation N owns
 * the first N - 1 of them.
 *
 * TBD past DIVINE. Candidates: rate x2, the xp-insight SIMULATION tier, extra
 * upgrade slots.
 */
export const REBIRTH_UNLOCKS = ['DIVINE'] as const;
export type RebirthUnlock = (typeof REBIRTH_UNLOCKS)[number];

export const unlocksForGeneration = (generation: number): readonly RebirthUnlock[] =>
	REBIRTH_UNLOCKS.slice(0, Math.max(0, generation - 1));

export const hasUnlock = (generation: number, unlock: RebirthUnlock): boolean =>
	unlocksForGeneration(generation).includes(unlock);

/**
 * Whether a score's breakdown should carry the divine judgement.
 *
 * A finished play answers with its own count: zero means the character never had
 * divine, since a play that could produce them is near certain to. A play that is
 * starting or still running has to ask the character instead - it may simply not
 * have landed one yet, so pass its `generation`.
 */
export const showsDivine = (divineCount: number, generation?: number): boolean =>
	generation === undefined
		? divineCount > 0
		: hasUnlock(generation, 'DIVINE');

/** `_old` is reserved for displaced names: a player may only pick one containing
 *  it when their own osu! username does. */
export const usesReservedOld = (name: string, osuUsername: string): boolean =>
	name.toLowerCase().includes(OLD_SUFFIX)
	&& !osuUsername.toLowerCase().includes(OLD_SUFFIX);

export const rebirthBody = characterNameBody;
export type RebirthBody = z.infer<typeof characterNameBody>;
