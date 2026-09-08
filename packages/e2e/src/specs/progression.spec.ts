import {
	expect,
	test,
} from '../support/fixtures';

/**
 * Upgrades: the first layer of the idle loop. Levels a skill earned are spent
 * for a permanent xp bonus, which costs the character the xp it spent - the
 * leaderboard drop is the price, by design.
 *
 * Reaching level ten honestly would take a long evening of plays, so these use
 * the dev xp multiplier song select already offers.
 */
test.describe('progression', () => {

	/**
	 * Cycle song select's dev xp multiplier up to `want`. x1000 is enough for a
	 * play to carry a skill past the ten levels the first upgrade costs, without
	 * burying the character in overdrive.
	 */
	const boostXp = async (page: import('@playwright/test').Page, want = 'x1000') => {
		const button = page.locator('.game__xp-btn');
		await expect(button).toBeVisible();
		let label = await button.innerText();
		for (let i = 0; i < 8 && label !== want; i++) {
			await button.click();
			label = await button.innerText();
		}
		expect(label).toBe(want);
	};

	test('a boosted play levels skills up', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		await boostXp(page);

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.waitForScores();

		const character = await game.character();
		expect(character.overallLevel).toBeGreaterThan(0);
		expect(character.skills.some(s => s.level >= 10)).toBe(true);
	});

	test('the character page buys an upgrade, and it costs levels', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		await boostXp(page);

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.waitForScores();
		await page.locator('.result__exit').click();
		await game.expectScene('SELECT');

		const before = await game.character();
		expect(before.skills.every(s => s.upgrades === 0)).toBe(true);

		// the dock's primary action is the way to the character page
		await page.locator('.dock__btn--upgrades').first().click();
		await expect(page.locator('.upgrades__list')).toBeVisible();

		const row = page.locator('.upgrade__row.is-ready').first();
		await expect(row).toBeVisible();
		const skill = await row.locator('.upgrade__skill').innerText();

		// the plain click asks first - the confirm names what the purchase costs
		await row.locator('.upgrade__buy').click();
		const menu = page.locator('.ctxmenu');
		await expect(menu).toBeVisible();
		await expect(menu.locator('.ctxmenu__sub')).toContainText('XP Lv');
		await menu.locator('.ctxmenu__option', { hasText: 'Buy' }).click();

		await expect.poll(async () => {
			const c = await game.character();
			return c.skills.reduce((n, s) => n + s.upgrades, 0);
		}).toBe(1);

		const after = await game.character();
		const bought = after.skills.find(s => s.upgrades === 1)!;
		const was = before.skills.find(s => s.name === bought.name)!;
		expect(bought.level).toBe(was.level - 10);
		// spending is a real cost: the xp goes out of the totals too
		expect(after.overallTotalXp).toBeLessThan(before.overallTotalXp);
		expect(skill.length).toBeGreaterThan(0);
	});

	test('a bought upgrade survives a reload', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		await boostXp(page);

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.waitForScores();
		await page.locator('.result__exit').click();

		await game.expectScene('SELECT');
		await page.locator('.dock__btn--upgrades').first().click();
		await expect(page.locator('.upgrades__list')).toBeVisible();

		// holding shift skips the confirm; the button says so before it is clicked
		const buy = page.locator('.upgrade__row.is-ready').first().locator('.upgrade__buy');
		await page.keyboard.down('Shift');
		await expect(buy).toHaveText('Buy');
		await buy.click();
		await page.keyboard.up('Shift');
		await expect.poll(async () => {
			const c = await game.character();
			return c.skills.reduce((n, s) => n + s.upgrades, 0);
		}).toBe(1);
		const before = await game.character();

		await game.open();
		const after = await game.character();
		expect(after.skills.reduce((n, s) => n + s.upgrades, 0)).toBe(1);
		expect(after.overallTotalXp).toBe(before.overallTotalXp);
	});

});
