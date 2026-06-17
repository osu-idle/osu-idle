import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { lingui } from '@lingui/vite-plugin';

const MIME: Record<string, string> = {
	'.osz': 'application/octet-stream',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
};

/**
 * Dev-server fallback for static asset filenames containing reserved chars that
 * can only travel percent-encoded - notably '#' (osu! set/preview folders carry
 * it). Vite's static middleware decodes request paths with `decodeURI`, which
 * leaves '#'/'?' encoded, so it never matches such files on disk and falls
 * through to the SPA index.html (which then fails to parse/unzip). Resolve those
 * requests against publicDir ourselves with full percent-decoding. Prod is
 * unaffected - the static host (nginx) decodes '%23' to '#' natively.
 */
function serveEncodedAssets(): Plugin {
	return {
		name: 'serve-encoded-assets',
		configureServer(server) {
			const root = path.resolve(server.config.publicDir);
			// registered inside configureServer (not the returned post hook) so it
			// runs before Vite's own static/SPA-fallback middlewares.
			server.middlewares.use((req, res, next) => {
				if (req.method !== 'GET' && req.method !== 'HEAD') return next();
				const reqPath = (req.url ?? '').split('?')[0];
				if (!/%(23|3F)/i.test(reqPath)) return next();
				let file: string;
				try { file = path.join(root, decodeURIComponent(reqPath)); }
				catch { return next(); }
				if (!file.startsWith(root + path.sep)) return next();
				fs.stat(file, (err, stat) => {
					if (err || !stat.isFile()) return next();
					res.setHeader('Content-Length', stat.size);
					res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
					if (req.method === 'HEAD') return void res.end();
					fs.createReadStream(file).pipe(res);
				});
			});
		},
	};
}

// https://vite.dev/config/
export default defineConfig({
	// `@vitejs/plugin-react` already runs Babel, so Lingui's macros transform
	// through its babel plugin here - no separate SWC/Babel toolchain. The lingui
	// plugin compiles the `.po` catalogs imported in src/i18n.ts.
	plugins: [
		react({ babel: { plugins: ['@lingui/babel-plugin-lingui-macro'] } }),
		lingui(),
		serveEncodedAssets(),
	],
	// `@osu-idle/shared` is a linked workspace package, so Vite doesn't pre-bundle
	// it and won't see the deps its sim pulls (osu-classes, osu-mania-stable) until
	// the gameplay/strain path first loads them. That late discovery triggers a dep
	// re-optimization mid-session; if it lands on an HMR update instead of a full
	// reload, react-dom stays on the old optimize hash while React core jumps to the
	// new one - two copies of React, and hooks crash with a null dispatcher. Listing
	// them here makes the first optimize pass complete so the hash never shifts.
	optimizeDeps: {
		include: [
			'osu-classes',
			'osu-mania-stable',
		],
	},
	server: {
		host: true,
		// Serve the osu! web platform at /web on the game's own origin so the
		// in-game browser iframe is same-origin. The web app runs its own dev
		// server (packages/web, :5174) with base '/web/'; we proxy to it.
		proxy: {
			'/web': {
				target: 'http://localhost:5174',
				changeOrigin: false,
				ws: true,
			},
		},
	},
	build: {
		target: 'esnext',
	}
});
