import { z } from 'zod';
import { Skills } from './skills.js';
import {
	xpForLevel,
	xpToLevel,
} from './sim/skills/xp.js';

export const UPGRADE_LEVELS = 10;
/** Slots on the base gear ladder, before any prestige. */
export const BASE_MAX_UPGRADES = 10;
/** Extra slots a prestige grants on that skill. */
export const UPGRADES_PER_PRESTIGE = 1;
/** Real levels between two gear tiers - the slots past the base ladder. */
export const GEAR_TIER_LEVELS = 1;
export const UPGRADE_XP_BONUS = 0.1;

/** Real level the first prestige needs; each one taken raises it. */
export const PRESTIGE_MIN_LEVEL = 100;
export const PRESTIGE_LEVEL_STEP = 1;
/** Multiplicative xp bonus per prestige, in its own pool. */
export const PRESTIGE_XP_BONUS = 0.1;
/** Overall character level that unlocks rebirth. */
export const REBIRTH_MIN_OVERALL_LEVEL = 110;
/** Effective-boost growth per overdrive decade: log10(2) doubles it. */
export const OVERDRIVE_EXPONENT = Math.log10(2);
export const OVERDRIVE_SCALE = 2.5;
/** Overdrive's display prefix (the XP multiplier keeps a plain "x"). */
export const OVERDRIVE_SYMBOL = 'σ';

export type UpgradeState = {
	level: number,
	xp: number,
	upgrades: number,
	overdrive: number,
	prestige: number,
};

export type UpgradePurchase = UpgradeState & {
	spent: number,
	ratio: number,
};

/** Slots available on a skill: the base ladder plus one per prestige. */
export const maxUpgrades = (prestige: number): number =>
	BASE_MAX_UPGRADES + prestige * UPGRADES_PER_PRESTIGE;

/** The level required to afford the next upgrade. The base ladder steps by
 *  UPGRADE_LEVELS; gear tiers past it step by one, so each lands on the same
 *  level as the prestige that granted it. */
export const upgradeMinLevel = (upgrades: number): number =>
	upgrades < BASE_MAX_UPGRADES
		? (upgrades + 1) * UPGRADE_LEVELS
		: BASE_MAX_UPGRADES * UPGRADE_LEVELS
			+ (upgrades - BASE_MAX_UPGRADES + 1) * GEAR_TIER_LEVELS;

/** Levels the next purchase spends: the base ladder costs UPGRADE_LEVELS, a gear
 *  tier costs the one level it stepped up by. */
export const upgradeCost = (upgrades: number): number =>
	upgrades < BASE_MAX_UPGRADES ? UPGRADE_LEVELS : GEAR_TIER_LEVELS;

/** Cost of the next upgrade bought exactly at its required level. */
export const upgradeMinSpend = (upgrades: number): number => {
	const min = upgradeMinLevel(upgrades);
	return xpToLevel(min) - xpToLevel(min - upgradeCost(upgrades));
};

export const canUpgrade = (
	{ level, upgrades, prestige }: Pick<UpgradeState, 'level' | 'upgrades' | 'prestige'>,
): boolean =>
	upgrades < maxUpgrades(prestige) && level >= upgradeMinLevel(upgrades);

/** Buy the next upgrade: drop its cost in levels (partial keeps its fraction),
 *  add the overspend ratio to overdrive. */
export const applyUpgrade = (state: UpgradeState): UpgradePurchase => {
	if (!canUpgrade(state)) throw new Error('upgrade not purchasable');

	const level = state.level - upgradeCost(state.upgrades);
	const xp = state.xp / xpForLevel(state.level) * xpForLevel(level);
	const spent = xpToLevel(state.level) + state.xp - xpToLevel(level) - xp;
	const ratio = spent / upgradeMinSpend(state.upgrades);

	return {
		level,
		xp,
		upgrades: state.upgrades + 1,
		overdrive: state.overdrive + (ratio > 1 ? ratio : 0),
		prestige: state.prestige,
		spent,
		ratio,
	};
};

/** The real level a skill needs to prestige again. Bonus levels never count. */
export const prestigeMinLevel = (prestige: number): number =>
	PRESTIGE_MIN_LEVEL + prestige * PRESTIGE_LEVEL_STEP;

export const canPrestige = (
	{ level, prestige }: Pick<UpgradeState, 'level' | 'prestige'>,
): boolean =>
	level >= prestigeMinLevel(prestige);

/** Prestige a skill: level, xp, upgrades and overdrive all go, and the skill
 *  keeps a bonus level, an extra gear tier and a bigger multiplier.
 *
 *  `spent` is everything the reset levels were worth. The caller takes it off
 *  the running totals, so the overall level falls with the skill - a character
 *  who has prestiged everything is not still carrying the level it all bought.
 *  Lifetime is the exception and never moves: it is what the tooltip hints at. */
export const applyPrestige = (state: UpgradeState): UpgradeState & { spent: number } => {
	if (!canPrestige(state)) throw new Error('prestige not available');

	return {
		level: 0,
		xp: 0,
		upgrades: 0,
		overdrive: 0,
		prestige: state.prestige + 1,
		spent: xpToLevel(state.level) + state.xp,
	};
};

export const canRebirth = (overallLevel: number): boolean =>
	overallLevel >= REBIRTH_MIN_OVERALL_LEVEL;

/** Effective boost of raw overdrive: degressive power law, floored at x1. */
export const overdriveMultiplier = (overdrive: number): number =>
	Math.max(1, Math.min(
		overdrive,
		OVERDRIVE_SCALE * Math.pow(overdrive, OVERDRIVE_EXPONENT),
	));

/** XP-gain multiplier: additive upgrade bonus, amplified by overdrive. */
export const upgradeXPMultiplier = (upgrades: number, overdrive: number): number =>
	1 + UPGRADE_XP_BONUS * upgrades * overdriveMultiplier(overdrive);

/** Its own pool: multiplicative, and multiplied with the upgrade bonus. */
export const prestigeXPMultiplier = (prestige: number): number =>
	Math.pow(1 + PRESTIGE_XP_BONUS, prestige);

/** Everything a skill's xp gain is multiplied by. */
export const skillXPMultiplier = (
	upgrades: number,
	overdrive: number,
	prestige: number,
): number =>
	upgradeXPMultiplier(upgrades, overdrive) * prestigeXPMultiplier(prestige);

export const upgradeBody = z.object({ skill: z.enum(Skills) });
export type UpgradeBody = z.infer<typeof upgradeBody>;

export const prestigeBody = z.object({ skill: z.enum(Skills) });
export type PrestigeBody = z.infer<typeof prestigeBody>;
