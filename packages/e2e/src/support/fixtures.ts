import {
	test as base,
	expect,
} from '@playwright/test';
import Game from './game';

/**
 * Every spec gets a fresh browser context, so the local sql.js database, the
 * IndexedDB it persists to and the settings all start empty: each test is a
 * first-run player.
 */

/** Console noise a healthy dev run produces anyway. */
const IGNORED = [
	/Download the React DevTools/i,
	/\[vite\]/i,
	/favicon/i,
	/WebSocket/i,
	/AudioContext/i,
	// the session probe a signed-out client makes on boot
	/401 \(Unauthorized\)/,
];

type Fixtures = {
	game: Game;
	/** Errors the page logged during the test, for specs that assert on them. */
	errors: string[];
};

export const test = base.extend<Fixtures>({
	errors: async ({ page }, use) => {
		const errors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() !== 'error') return;
			const text = msg.text();
			if (IGNORED.some(p => p.test(text))) return;
			errors.push(text);
		});
		page.on('pageerror', (err) => errors.push(String(err)));
		await use(errors);
	},
	game: async ({ page }, use) => {
		await use(new Game(page));
	},
});

export { expect };
