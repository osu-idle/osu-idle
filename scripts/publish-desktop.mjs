#!/usr/bin/env node
// Publish the built desktop installers + auto-update feed so the website serves
// them at /download, plus a manifest the web "Play osu!idle" page reads (latest
// version + per-platform filenames).
//
// The site's Apache DocumentRoot is packages/client/dist, so /download is just
// dist/download. Like beatmaps/previews, the durable copy lives in the client's
// public/ (re-emitted into dist on every client build, so a later `newmap`/client
// rebuild never wipes it); we also drop it straight into the current dist so this
// deploy serves the new build immediately, before any rebuild. Set
// DESKTOP_PUBLISH_DIR to publish to a single explicit path instead.
//
// Expects the installers already built (packages/desktop: build + dist:linuxwin).
// Public URL is configured in packages/desktop/electron-builder.yml.

import {
	readdir,
	copyFile,
	writeFile,
	mkdir,
	readFile,
} from 'node:fs/promises';
import {
	dirname,
	join,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE = join(ROOT, 'packages/desktop/release');

// CLIENT_DIST points at the served client build - overridden to the staged
// `dist.next` by the staged deploy, so installers ride along into the swap.
const CLIENT_DIST = process.env.CLIENT_DIST ?? 'packages/client/dist';
const dests = process.env.DESKTOP_PUBLISH_DIR
	? [process.env.DESKTOP_PUBLISH_DIR]
	: [
		join(ROOT, 'packages/client/public/download'), // durable: re-emitted to dist on every client build
		join(ROOT, CLIENT_DIST, 'download'),           // immediate: served this deploy without a rebuild
	];

const { version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));

let entries;
try {
	entries = await readdir(RELEASE);
} catch {
	console.error(`[publish-desktop] no build output at ${RELEASE} - run the desktop build first.`);
	process.exit(1);
}

// installers (osu-idle.exe / osu-idle.AppImage) + the electron-updater feed
// (latest*.yml) and its delta maps. Exclude the NSIS uninstaller intermediate
// and electron-builder's own debug yml so neither leaks into the public dir.
const artifacts = entries.filter(f => {
	if (/^__uninstaller/i.test(f)) return false;
	if (/^builder-/i.test(f)) return false;
	return /\.(exe|AppImage|blockmap)$/i.test(f) || /^latest.*\.yml$/i.test(f);
});
if (artifacts.length === 0) {
	console.error('[publish-desktop] no installers found in the build output.');
	process.exit(1);
}

const manifest = JSON.stringify({
	version,
	files: {
		windows: artifacts.find(f => f.toLowerCase().endsWith('.exe')) ?? null,
		linux: artifacts.find(f => f.toLowerCase().endsWith('.appimage')) ?? null,
	},
}, null, 2) + '\n';

for (const dest of dests) {
	await mkdir(dest, { recursive: true });
	for (const file of artifacts) {
		await copyFile(join(RELEASE, file), join(dest, file));
	}
	await writeFile(join(dest, 'manifest.json'), manifest);
	console.log(
		`[publish-desktop] published ${artifacts.length} artifact(s) + manifest (v${version}) to ${dest}`,
	);
}
