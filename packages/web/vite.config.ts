import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { lingui } from '@lingui/vite-plugin';

const require = createRequire(import.meta.url);

// plotly.js-dist-min is shipped pre-minified and never changes. Bundling it made
// every build spend ~15s re-minifying a 4.7MB blob, so we keep it external (see
// rollupOptions.external + OsuPlot's runtime <script> load) and just copy the
// prebuilt file into dist/assets verbatim - no transform, no minify.
function plotlyAsset(): Plugin {
	return {
		name: 'plotly-static-asset',
		generateBundle() {
			const source = readFileSync(require.resolve('plotly.js-dist-min/plotly.min.js'));
			this.emitFile({ type: 'asset', fileName: 'assets/plotly.min.js', source });
		},
	};
}

// Served at /web on the same origin as the game. In dev the game's Vite server
// proxies /web here (see packages/client/vite.config.ts); in prod this builds
// into the game's dist so one static directory serves both at one origin.
export default defineConfig({
	base: '/web/',
	// `@vitejs/plugin-react` already runs Babel, so Lingui's macros transform
	// through its babel plugin here - no separate SWC/Babel toolchain. The lingui
	// plugin compiles the `.po` catalogs imported in src/i18n.ts.
	plugins: [
		react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
		lingui(),
		plotlyAsset(),
	],
	server: {
		port: 5174,
		strictPort: true,
		// The page is loaded via the game's origin (proxied), so point the HMR
		// socket straight at this dev server to survive the proxy hop.
		hmr: {
			host: 'localhost',
			protocol: 'ws',
			port: 5174,
		},
	},
	build: {
		target: 'esnext',
		outDir: 'dist',
		emptyOutDir: true,
		// Loaded at runtime via a <script> tag (see plotlyAsset + OsuPlot), so it
		// must never be pulled into the module graph.
		rollupOptions: { external: ['plotly.js-dist-min'] },
	},
});
