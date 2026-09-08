import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The play belongs to the session, not to the playfield: leaving gameplay
 * leaves the play running, and it finishes - and pays - with nobody watching.
 * That is the whole idle loop, so it is what these check.
 */
test.describe('background play', () => {

	test('quitting gameplay leaves the play running, and the dock says so', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();

		await game.search(set.title);
		await game.playCard(version.id);
		const play = await game.waitForPlay();

		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		const still = await game.play();
		expect(still?.token).toBe(play.token);

		await expect(page.locator('.dock--panel')).toBeVisible();
		await expect(page.locator('.dock__now .dock__map')).toContainText(set.title);
	});

	test('a play nobody watches still saves its score and pays its xp', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		const before = await game.character();

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		// the local session owns the play; it ends on its own clock, so pull it in
		await game.finishPlay();

		const scores = await game.waitForScores();
		expect(scores[0].beatmapId).toBe(version.id);
		expect((await game.character()).overallTotalXp)
			.toBeGreaterThan(before.overallTotalXp);

		// waiting in song select is waiting for the result, so it is shown -
		// but nothing drags the player back onto the playfield
		await game.expectScene('RESULT');
	});

	test('aborting a play throws it away', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		const before = await game.character();

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();

		await page.locator('.play__abort').click();
		await page.locator('.ctxmenu__option', { hasText: 'Abort' }).first().click();

		await game.waitForNoPlay();
		await game.expectScene('SELECT');
		expect(await game.scores()).toHaveLength(0);
		expect((await game.character()).overallTotalXp).toBe(before.overallTotalXp);
	});

	test('the dock watches a play back into gameplay', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();

		await game.search(set.title);
		await game.playCard(version.id);
		const play = await game.waitForPlay();
		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		await page.locator('.dock__btn', { hasText: 'watch' }).click();
		await game.expectScene('GAME');

		// the same play, joined - not a second one started over it
		expect((await game.play())?.token).toBe(play.token);
	});

	test('a result lands quietly when the player is elsewhere', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		// back out to the main menu: not the screen a result is shown on
		await page.keyboard.press('Escape');
		await game.expectScene('MENU');

		await game.finishPlay();
		await game.waitForScores();
		expect(await game.scene()).toBe('MENU');
	});

});
