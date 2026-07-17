import { z } from 'zod';
import { Skills } from './skills.js';
import {
	xpForLevel,
	xpToLevel,
} from './sim/skills/xp.js';

export const UPGRADE_LEVELS = 10;
export const MAX_UPGRADES = 2;
export const UPGRADE_XP_BONUS = 0.1;
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
};

export type UpgradePurchase = UpgradeState & {
	spent: number,
	ratio: number,
};

/** The level required to afford the next upgrade. */
export const upgradeMinLevel = (upgrades: number): number =>
	(upgrades + 1) * UPGRADE_LEVELS;

/** The minimum spendable XP for the next upgrade: the cost when purchased
 *  exactly at its required level. */
export const upgradeMinSpend = (upgrades: number): number => {
	const min = upgradeMinLevel(upgrades);
	return xpToLevel(min) - xpToLevel(min - UPGRADE_LEVELS);
};

export const canUpgrade = (
	{ level, upgrades }: Pick<UpgradeState, 'level' | 'upgrades'>,
): boolean =>
	upgrades < MAX_UPGRADES && level >= upgradeMinLevel(upgrades);

/**
 * Purchase the skill's next upgrade: spend the top UPGRADE_LEVELS levels, and
 * accumulate overdrive from the overspend ratio. Only an overspent purchase
 * (ratio > 1) feeds overdrive. The partial level keeps its *fraction* of the
 * bar, not its absolute XP - a high-level partial is worth whole low levels
 * and would overshoot the drop; the shrunk remainder counts as spent.
 */
export const applyUpgrade = (state: UpgradeState): UpgradePurchase => {
	if (!canUpgrade(state)) throw new Error('upgrade not purchasable');

	const level = state.level - UPGRADE_LEVELS;
	const xp = state.xp / xpForLevel(state.level) * xpForLevel(level);
	const spent = xpToLevel(state.level) + state.xp - xpToLevel(level) - xp;
	const ratio = spent / upgradeMinSpend(state.upgrades);

	return {
		level,
		xp,
		upgrades: state.upgrades + 1,
		overdrive: state.overdrive + (ratio > 1 ? ratio : 0),
		spent,
		ratio,
	};
};

/**
 * Effective boost of the stored raw overdrive: a true multiplier while small,
 * degressive past the curves' crossover (~x3.7) - x2 → x2, x10 → x5,
 * x100 → x10, x1000 → x20 - and floored at x1.
 */
export const overdriveMultiplier = (overdrive: number): number =>
	Math.max(1, Math.min(
		overdrive,
		OVERDRIVE_SCALE * Math.pow(overdrive, OVERDRIVE_EXPONENT),
	));

/** The skill's total XP-gain multiplier: the additive per-upgrade bonus,
 *  amplified by overdrive. */
export const upgradeXPMultiplier = (upgrades: number, overdrive: number): number =>
	1 + UPGRADE_XP_BONUS * upgrades * overdriveMultiplier(overdrive);

export const upgradeBody = z.object({ skill: z.enum(Skills) });
export type UpgradeBody = z.infer<typeof upgradeBody>;
