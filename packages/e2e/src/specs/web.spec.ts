import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The profile/leaderboard platform. It is its own app, served under /web on the
 * game's origin (that is what lets the in-game browser be an iframe), and every
 * page here is one a signed-out visitor can reach.
 */
test.describe('web platform', () => {

	test('a visitor gets the landing page, with live stats on it', async ({ page }) => {
		await page.goto('/web/');
		// signed out, the front page is the landing rather than the dashboard
		await expect(page.locator('.landing')).toBeVisible();
		await expect(page.locator('.landing__signin')).toBeVisible();
		// the counters come off the API, so they say the server answered
		await expect(page.locator('.stats__item').first()).not.toBeEmpty();
	});

	test('the global ranking lists players, and paging is in the URL', async ({ page }) => {
		await page.goto('/web/rankings/global');
		const table = page.locator('.player__lb_listing');
		await expect(table).toBeVisible();
		await expect(table.locator('tbody tr').first()).toBeVisible();

		// pagination and filters are typed search params, not component state
		await page.goto('/web/rankings/global?page=2');
		await expect(table).toBeVisible();
		expect(new URL(page.url()).searchParams.get('page')).toBe('2');
	});

	test('the ranking nav moves between boards', async ({ page }) => {
		await page.goto('/web/rankings/global');
		await expect(page.locator('.player__lb_listing')).toBeVisible();

		await page.locator('.nav__item', { hasText: 'country' }).first().click();
		await expect(page).toHaveURL(/\/web\/rankings\/country/);
		await expect(page.locator('.nav__item.current')).toHaveText('country');
	});

	test('the map listing and the request queue are reachable signed out', async ({ page }) => {
		await page.goto('/web/maps');
		await expect(page.locator('.page-contents').first()).toBeVisible();

		await page.goto('/web/maps/requests');
		await expect(page.locator('.requests__toolbar')).toBeVisible();
		// proposing a map is for signed-in players; a visitor is told so
		await expect(page.locator('.requests__signed-out')).toBeVisible();
	});

	test('news and the download page render', async ({ page }) => {
		await page.goto('/web/news');
		await expect(page.locator('.page-contents').first()).toBeVisible();

		await page.goto('/web/download');
		await expect(page.locator('main')).toBeVisible();
	});

	test('the client serves it on its own origin, for the in-game browser', async ({ game, page }) => {
		await game.start();
		// the in-game browser is a same-origin iframe: /web has to answer on the
		// game's own origin, not just on the web app's dev port
		const res = await page.request.get('/web/rankings/global');
		expect(res.status()).toBe(200);
		expect(res.url()).toContain(new URL(page.url()).origin);
	});

});
