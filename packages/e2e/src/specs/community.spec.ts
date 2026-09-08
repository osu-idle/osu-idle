import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The community overlay - osu!'s F9. It rides the one WebSocket, so these also
 * say the socket connected at all: presence and the world map only have
 * anything in them because the server answered.
 */
test.describe('community overlay', () => {

	test('F9 opens the players panel, Esc closes it', async ({ game, page }) => {
		await game.start();
		const panel = page.locator('.community-panel');
		await expect(panel).not.toHaveClass(/is-enabled/);

		await page.keyboard.press('F9');
		await expect(panel).toHaveClass(/is-enabled/);

		// the roster's last tab is the world map, drawn from coarse presence coords
		await panel.locator('.tab', { hasText: 'World Map' }).click();
		await expect(page.locator('.community-map')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(panel).not.toHaveClass(/is-enabled/);
		// closing the overlay must not take song select with it
		expect(await game.scene()).toBe('SELECT');
	});

	test('F8 opens chat on its own', async ({ game, page }) => {
		await game.start();
		const chat = page.locator('.community-chat-container');
		await expect(chat).not.toHaveClass(/is-enabled/);

		await page.keyboard.press('F8');
		await expect(chat).toHaveClass(/is-enabled/);

		await page.keyboard.press('Escape');
		await expect(chat).not.toHaveClass(/is-enabled/);
	});

	test('the overlay controls toggle the same panels', async ({ game, page }) => {
		await game.start();
		await page.locator('.community-controls button', { hasText: 'Online users' }).click();
		await expect(page.locator('.community-panel')).toHaveClass(/is-enabled/);

		await page.locator('.community-controls button', { hasText: 'Hide chat' }).click();
		await expect(page.locator('.community-chat-container')).not.toHaveClass(/is-enabled/);
	});

	test('auto-hide steps the overlay aside for gameplay, then brings it back', async ({
		game, page,
	}) => {
		await game.start();
		const { set, version } = await game.installEasiest();
		const panel = page.locator('.community-panel');

		// pick the map first: with the roster open it covers the carousel, so the
		// play is started from the keyboard
		await game.search(set.title);
		await game.selectCard(version.id);
		await page.keyboard.press('F9');
		await expect(panel).toHaveClass(/is-enabled/);

		// off by default - the overlay only steps aside if it was asked to
		const autoHide = page.locator('.community-controls button', { hasText: 'Auto-hide' });
		await autoHide.click();
		await expect(autoHide).toHaveAttribute('data-on', 'true');

		await game.playSelected();
		// auto-hide: the playfield is not the place for it
		await expect(panel).not.toHaveClass(/is-enabled/);

		await game.waitForPlay();
		await game.skipToEnd();
		await game.expectScene('RESULT');
		await expect(panel).toHaveClass(/is-enabled/);
	});

});
