import {
	expect,
	test,
} from '../support/fixtures';

test.describe('boot', () => {

	test('the intro hands over to the main menu, which reaches song select', async ({ game, page }) => {
		await game.open();

		await expect(page.locator('.intro')).toBeVisible();
		expect(await game.scene()).toBe('INTRO');

		await game.enterMenu();
		await expect(page.locator('.menu__brand-version')).toContainText(/^v\d+\.\d+\.\d+\.\d+$/);

		await game.enterSongSelect();
		await expect(page.locator('.bm-card').first()).toBeVisible();
	});

	test('a first run is the local guest', async ({ game }) => {
		await game.open();
		const character = await game.character();
		expect(character.guest).toBe(true);
		// the local lineage lives below zero, apart from the server's id space
		expect(character.id).toBeLessThan(0);
		expect(character.overallTotalXp).toBe(0);
		expect(character.skills.length).toBeGreaterThan(0);
	});

	test('the catalog lists downloadable sets and none are installed yet', async ({ game }) => {
		await game.open();
		expect(await game.installedSets()).toHaveLength(0);

		const { set, version } = await game.easiestMap();
		expect(set.versions.length).toBeGreaterThan(0);
		expect(version.length).toBeGreaterThan(0);
		expect(version.keys).toBe(4);
	});

	test('booting logs no errors', async ({ game, errors }) => {
		await game.start();
		expect(errors).toEqual([]);
	});

});
