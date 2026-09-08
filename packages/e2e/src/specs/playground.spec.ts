import {
	expect,
	test,
} from '../support/fixtures';

/**
 * The component bench at `?playground`. Its cases exist to reach states a play
 * cannot reach quickly, so a case that throws is a component that would throw
 * in the game - which is worth knowing without playing to level 80.
 */
test.describe('playground', () => {

	test('every case renders without an error', async ({ page, errors }) => {
		await page.goto('/?playground');
		const stage = page.locator('.playground__stage');
		await expect(stage).toHaveAttribute('data-playground-ready', 'true');

		const cases = await page.locator('.playground__case').evaluateAll(
			(nodes) => nodes.map(n => n.getAttribute('data-case')!),
		);
		expect(cases.length).toBeGreaterThan(0);

		// open each by URL rather than by clicking the bar: some cases render
		// fixed chrome of their own over it
		for (const id of cases) {
			await page.goto(`/?playground=${id}`);
			await expect(stage).toHaveAttribute('data-playground-ready', 'true');
			await expect(page.locator('.playground__case.is-active'))
				.toHaveAttribute('data-case', id);
			await expect(stage.locator('> div')).not.toBeEmpty();
		}

		expect(errors, `playground cases logged errors: ${errors.join(' | ')}`).toEqual([]);
	});

	test('a case can be opened directly by id', async ({ page }) => {
		await page.goto('/?playground=dock-panel');
		const stage = page.locator('.playground__stage');
		await expect(stage).toHaveAttribute('data-playground-ready', 'true');
		await expect(page.locator('.playground__case.is-active')).toHaveAttribute(
			'data-case', 'dock-panel',
		);
		await expect(page.locator('.dock')).toBeVisible();
	});

});
