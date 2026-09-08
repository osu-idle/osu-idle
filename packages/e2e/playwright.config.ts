import {
	defineConfig,
	devices,
} from '@playwright/test';

/**
 * The end-to-end suite runs against the *dev* stack (client on :5173, which
 * proxies /web to :5174, both talking to the API on :3873). It is deliberately
 * kept out of `npm test`: a spec here boots a browser, downloads a beatmap and
 * plays it, so it is minutes where the vitest suite is seconds.
 *
 * `webServer` reuses the dev server the developer already has running and only
 * starts one when there is none.
 */

const PORT = Number(process.env.E2E_PORT ?? 5173);

export default defineConfig({
	testDir: './src/specs',
	outputDir: './test-results',
	// a play is a real clock, and a first-run context downloads a beatmap
	timeout: 180_000,
	expect: { timeout: 20_000 },
	fullyParallel: false,
	workers: process.env.CI ? 1 : 2,
	retries: process.env.CI ? 1 : 0,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI
		? [['github'], ['html', { open: 'never' }]]
		: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: `http://localhost:${PORT}`,
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure',
		actionTimeout: 20_000,
	},
	projects: [
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				viewport: {
					width: 1280, height: 800,
				},
				launchOptions: {
					args: [
						// the intro gates on a click, but song select previews and
						// gameplay audio must not need one of their own
						'--autoplay-policy=no-user-gesture-required',
						'--mute-audio',
						// the gameplay canvas is drawn every frame; keep it off the
						// GPU so a headless run is deterministic
						'--disable-gpu',
					],
				},
			},
		},
	],
	webServer: {
		command: 'npm run dev',
		cwd: '../..',
		url: `http://localhost:${PORT}`,
		reuseExistingServer: true,
		timeout: 180_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
