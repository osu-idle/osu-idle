import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Resolve a sibling package's source dir, so tests run against current source
 *  (no rebuild needed) rather than the compiled `dist/`. */
const src = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src`, import.meta.url));

export default defineConfig({
	resolve: {
		// `@osu-idle/shared/foo` → `../shared/src/foo`. The package's own `exports`
		// map points at `dist/`; aliasing to source keeps the suite testing the
		// code you're editing. Add server/client/web here if/when they're imported.
		alias: {
			'@osu-idle/shared': src('shared'),
			'@osu-idle/client': src('client'),
		},
	},
	test: {
		environment: 'node', // pure logic - no DOM, no browser automation
		include: ['src/**/*.test.ts'],
		// Scenario tests run a chart many times; dense charts need headroom.
		testTimeout: 600000,
		hookTimeout: 600000,
		teardownTimeout: 600000,
	},
});
