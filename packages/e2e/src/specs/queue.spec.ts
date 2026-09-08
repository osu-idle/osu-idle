import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The play queue: the ordered list the character works through on its own. It
 * is built from song select in queue mode, reordered from the dock, and the
 * head of it is always what plays next.
 */
test.describe('play queue', () => {

	test('queue mode adds maps, and the top of the list plays next', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		const other = set.versions.find(v => v.id !== version.id);
		test.skip(!other, 'the easiest set has a single difficulty');

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		// the dock's queue button opens song select in queue mode: a click queues
		await page.locator('.dock__btn', { hasText: 'queue' }).click();
		await expect(page.locator('.game--queueing')).toBeVisible();

		await game.search(set.title);
		await game.queueCard(other!.id);

		await expect(page.locator('.dock__entry').first()).toBeVisible();
		const queued = await game.queue();
		expect(queued?.entries.some(e => e.id === other!.id)).toBe(true);
	});

	test('the dock reorders and empties the queue', async ({ game, page }) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		test.skip(set.versions.length < 3, 'the easiest set has too few difficulties');

		await game.search(set.title);
		await game.playCard(version.id);
		await game.waitForPlay();
		await page.locator('.play__quit').click();
		await game.expectScene('SELECT');

		await page.locator('.dock__btn', { hasText: 'queue' }).click();
		const others = set.versions.filter(v => v.id !== version.id).slice(0, 2);
		for (const v of others) await game.queueCard(v.id);

		// back to song select, where the dock is the queue's own panel
		await page.keyboard.press('Escape');
		await expect(page.locator('.game--queueing')).toBeHidden();

		const before = await game.queue();
		expect(before!.entries.length).toBeGreaterThanOrEqual(2);

		// move the second entry up: the queue is an order, not a suggestion. Its
		// controls only appear under the pointer, so hover the row first.
		const second = before!.entries[1];
		const row = page.locator('.dock__entry').nth(1);
		await page.locator('.dock--panel').hover();
		await row.hover();
		await row.locator('button', { hasText: '↑' }).click();
		await expect.poll(async () => (await game.queue())?.entries[0].id).toBe(second.id);

		await page.locator('.dock__btn', { hasText: 'clear' }).click();
		await expect.poll(async () => (await game.queue())?.entries.length ?? 0).toBe(0);
	});

	test('the queue chains the next map when a play ends', async ({ game, page }) => {
		await game.start();
		// the wait between plays is a setting; a test has no patience for 30s
		await page.evaluate(() => window.__idle!.setSetting('autopilotDelay', 1));

		const { set, version } = await game.installEasiest();
		const other = set.versions.find(v => v.id !== version.id);
		test.skip(!other, 'the easiest set has a single difficulty');

		await game.search(set.title);
		await game.playCard(version.id);
		const first = await game.waitForPlay();
		await page.locator('.play__quit').click();

		await page.locator('.dock__btn', { hasText: 'queue' }).click();
		await game.queueCard(other!.id);
		await page.keyboard.press('Escape');

		await game.finishPlay();

		// the manager takes the head of the queue and starts it, wherever we are
		await expect.poll(
			async () => {
				const live = await game.play();
				return live && live.token !== first.token ? live.beatmapId : undefined;
			},
			{
				timeout: 90_000, message: 'waiting for the queue to chain',
			},
		).toBe(other!.id);
	});

});
