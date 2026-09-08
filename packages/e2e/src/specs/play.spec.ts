import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The core loop, as a signed-out player runs it: find a map, download it, play
 * it, and see what it paid.
 *
 * A play is a clock over an outcome that was decided when it started, so these
 * end it early rather than waiting the song out - the score is the same either
 * way.
 */
test.describe('guest play', () => {

	test('a set downloads from the carousel and becomes playable', async ({ game, page }) => {
		await game.start();
		const { set } = await game.easiestMap();

		await game.search(set.title);
		const card = page.locator('.bm-card').first();
		await expect(card).toBeVisible();
		await expect(card).toHaveClass(/is-remote/);

		// select, then double-click: how song select downloads a set
		await card.click();
		await card.dblclick();

		await expect(page.locator('.bm-card.is-downloaded').first()).toBeVisible({ timeout: 120_000 });
		expect(await game.installedSets()).toContain(set.id);
	});

	test('playing a map reaches gameplay, then the result screen', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();

		await game.search(set.title);
		await game.playCard(version.id);
		await expect(page.locator('.play canvas').first()).toBeVisible();

		const play = await game.waitForPlay();
		expect(play.beatmapId).toBe(version.id);
		expect(play.mode).toBe('guest');
		expect(play.endsAt).toBeGreaterThan(play.startedAt);

		await game.skipToEnd();

		await game.expectScene('RESULT');
		await expect(page.locator('.resultscreen')).toBeVisible();
		await expect(page.locator('.result__score')).not.toBeEmpty();
	});

	test('a passed play saves a score and pays xp', async ({ game }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		const before = await game.character();
		expect(await game.scores()).toHaveLength(0);

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.expectScene('RESULT');

		const scores = await game.waitForScores();
		expect(scores).toHaveLength(1);
		expect(scores[0].beatmapId).toBe(version.id);
		expect(scores[0].score).toBeGreaterThan(0);
		expect(scores[0].accuracy).toBeGreaterThan(0);
		expect(scores[0].accuracy).toBeLessThanOrEqual(1);
		expect(scores[0].maxCombo).toBeGreaterThan(0);
		expect(scores[0].grade).toMatch(/^(XH|X|SH|S|A|B|C|D)$/);

		const after = await game.character();
		expect(after.overallTotalXp).toBeGreaterThan(before.overallTotalXp);

		const gains = await game.xpGains();
		expect(gains).toHaveLength(1);
		expect(gains[0].beatmapId).toBe(version.id);
		expect(Object.values(gains[0].gains).some(g => g > 0)).toBe(true);
	});

	test('a failed play saves nothing and pays nothing', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.hardestMap();
		await game.install(set.id);
		const before = await game.character();

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.expectScene('RESULT');

		// a level-zero character cannot survive the hardest map in the catalog
		await expect(page.locator('.result__failed')).toBeVisible();
		expect(await game.scores()).toHaveLength(0);
		expect((await game.character()).overallTotalXp).toBe(before.overallTotalXp);
	});

	test('the result screen leads back to song select, with the play in history', async ({
		game, page,
	}) => {
		await game.start();
		const { set, version } = await game.installEasiest();

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await game.skipToEnd();
		await game.expectScene('RESULT');
		await game.waitForScores();

		await page.locator('.result__exit').click();
		await game.expectScene('SELECT');

		// the card now carries the grade the play earned
		await game.search(set.title);
		await expect(game.card(version.id).locator('img.skin__grade')).toBeVisible();
	});

});
