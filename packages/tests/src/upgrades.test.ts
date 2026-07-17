import {
	describe,
	it,
	expect,
} from 'vitest';
import {
	MAX_UPGRADES,
	UPGRADE_LEVELS,
	UPGRADE_XP_BONUS,
	applyUpgrade,
	canUpgrade,
	overdriveMultiplier,
	upgradeMinLevel,
	upgradeMinSpend,
	upgradeXPMultiplier,
} from '@osu-idle/shared/upgrades';
import {
	xpForLevel,
	xpToLevel,
} from '@osu-idle/shared/sim/skills/xp';

const fresh = {
	upgrades: 0, overdrive: 0,
};

describe('upgrade cost', () => {
	it('requires the level ladder to climb by UPGRADE_LEVELS per purchase', () => {
		expect(upgradeMinLevel(0)).toBe(UPGRADE_LEVELS);
		expect(upgradeMinLevel(1)).toBe(2 * UPGRADE_LEVELS);
	});

	it('min spend is the XP of the levels right below the requirement', () => {
		expect(upgradeMinSpend(0)).toBe(xpToLevel(UPGRADE_LEVELS));
		expect(upgradeMinSpend(1))
			.toBe(xpToLevel(2 * UPGRADE_LEVELS) - xpToLevel(UPGRADE_LEVELS));
	});

	it('is not purchasable below the required level', () => {
		expect(canUpgrade({
			level: UPGRADE_LEVELS - 1, upgrades: 0,
		})).toBe(false);
		expect(canUpgrade({
			level: UPGRADE_LEVELS, upgrades: 0,
		})).toBe(true);
	});

	it('is capped at MAX_UPGRADES', () => {
		expect(canUpgrade({
			level: 100, upgrades: MAX_UPGRADES,
		})).toBe(false);
	});
});

describe('applyUpgrade', () => {
	it('buying exactly at the minimum drains to level 0 with no overdrive', () => {
		const p = applyUpgrade({
			level: UPGRADE_LEVELS, xp: 0, ...fresh,
		});
		expect(p.level).toBe(0);
		expect(p.xp).toBe(0);
		expect(p.upgrades).toBe(1);
		expect(p.spent).toBe(upgradeMinSpend(0));
		expect(p.ratio).toBe(1);
		expect(p.overdrive).toBe(0);
	});

	it('spends the top UPGRADE_LEVELS levels, keeping the partial fraction (Lv15 → Lv5)', () => {
		const from = UPGRADE_LEVELS + 5;
		const p = applyUpgrade({
			level: from, xp: 50, ...fresh,
		});
		expect(p.level).toBe(5);
		expect(p.xp / xpForLevel(5)).toBeCloseTo(50 / xpForLevel(from), 10);
		// the shrunk partial counts as spent: the absolute XP delta
		expect(p.spent)
			.toBeCloseTo(xpToLevel(from) + 50 - xpToLevel(5) - p.xp, 6);
	});

	it('drops exactly UPGRADE_LEVELS even past level 100 (Lv100.2 → Lv90.2)', () => {
		// A Lv100 partial is worth whole low levels in absolute XP - the level
		// must still land exactly UPGRADE_LEVELS lower, fraction preserved.
		const xp = xpForLevel(100) * 0.2;
		const p = applyUpgrade({
			level: 100, xp, ...fresh,
		});
		expect(p.level).toBe(100 - UPGRADE_LEVELS);
		expect(p.xp / xpForLevel(p.level)).toBeCloseTo(0.2, 10);
	});

	it('overspending feeds overdrive with the spend ratio', () => {
		const level = 3 * UPGRADE_LEVELS;
		const p = applyUpgrade({
			level, xp: 0, ...fresh,
		});
		const ratio = (xpToLevel(level) - xpToLevel(level - UPGRADE_LEVELS)) / upgradeMinSpend(0);
		expect(ratio).toBeGreaterThan(1);
		expect(p.ratio).toBeCloseTo(ratio, 10);
		expect(p.overdrive).toBeCloseTo(ratio, 10);
	});

	it('refuses an unaffordable purchase', () => {
		expect(() => applyUpgrade({
			level: UPGRADE_LEVELS - 1, xp: 0, ...fresh,
		})).toThrow();
	});
});

describe('overdrive & XP multiplier', () => {
	it('is floored at x1 and a true multiplier while small', () => {
		expect(overdriveMultiplier(0)).toBe(1);
		expect(overdriveMultiplier(1)).toBe(1);
		expect(overdriveMultiplier(2)).toBe(2);
	});

	it('maps large raw overdrive degressively (x10 → x5, x100 → x10, x1000 → x20)', () => {
		expect(overdriveMultiplier(10)).toBeCloseTo(5, 10);
		expect(overdriveMultiplier(100)).toBeCloseTo(10, 10);
		expect(overdriveMultiplier(1000)).toBeCloseTo(20, 10);
	});

	it('multiplies the additive upgrade bonus, not the whole XP', () => {
		expect(upgradeXPMultiplier(0, 0)).toBe(1);
		expect(upgradeXPMultiplier(1, 0)).toBeCloseTo(1 + UPGRADE_XP_BONUS, 10);
		expect(upgradeXPMultiplier(1, 5))
			.toBeCloseTo(1 + UPGRADE_XP_BONUS * overdriveMultiplier(5), 10);
		expect(upgradeXPMultiplier(2, 5))
			.toBeCloseTo(1 + 2 * UPGRADE_XP_BONUS * overdriveMultiplier(5), 10);
	});
});
