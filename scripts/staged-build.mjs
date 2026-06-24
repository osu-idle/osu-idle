#!/usr/bin/env node
// Build the production bundles WITHOUT touching the live site until everything
// is verified. Client/web `vite build` writes straight into the Apache-served
// dist with emptyOutDir, so building in place means a mid-build failure wipes or
// half-replaces prod. Instead we build into `dist.next`, and only once every
// build below succeeds do we swap it into the live dir with a rename.
//
// Run between writing the bumped version and committing it (version-bump's
// --verify): a failure here exits non-zero so the bump is rolled back and
// nothing is persisted.

import { spawn } from 'node:child_process';
import {
	rm,
	rename,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
	dirname,
	join,
} from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = 'dist.next';

// The trees Apache serves: client is the DocumentRoot, web is the `/web` alias.
// Each builds into STAGING and is swapped into `dist` only after a clean build.
const SERVED = [
	{
		pkg: 'packages/client', live: 'dist', 
	},
	{
		pkg: 'packages/web', live: 'dist', 
	},
];

const abs = (...p) => join(ROOT, ...p);

function run(command, env) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, {
			cwd: ROOT, stdio: 'inherit', shell: true, env: {
				...process.env, ...env, 
			}, 
		});
		child.on('close', code => code === 0 ?
			resolve() 
			: reject(new Error(`\`${command}\` exited ${code}`)));
		child.on('error', reject);
	});
}

async function cleanStaging() {
	for (const { pkg } of SERVED) await rm(abs(pkg, STAGING), {
		recursive: true, force: true, 
	});
}

async function build() {
	// A leftover staging tree from a previous failed run would poison the swap.
	await cleanStaging();

	// shared carries VERSION + the compiled catalogs; rebuild it so the staged
	// client/web bundle the just-bumped version. server types feed RPC typing.
	await run('npm -w @osu-idle/shared run build');
	await run('npm -w @osu-idle/server run build:types');

	// The failure-prone bit: client/web into dist.next, never the live dir. Vite
	// copies each package's public/ as today, so the staged tree is complete.
	await run('npm -w @osu-idle/client run build -- --outDir dist.next --emptyOutDir');
	await run('npm -w @osu-idle/web run build -- --outDir dist.next --emptyOutDir');

	// Desktop reads the staged renderer (RENDERER_DIST) and publishes installers
	// into the staged client tree (CLIENT_DIST), so a desktop failure aborts with
	// nothing live changed, and a success rides into the swap with everything else.
	await run('npm -w @osu-idle/desktop run dist', { RENDERER_DIST: STAGING });
	await run('node scripts/publish-desktop.mjs', { CLIENT_DIST: `packages/client/${STAGING}` });
}

// Promote each verified build into the live dir with a rename (instant, same
// filesystem). The brief window between the two renames is harmless - web is an
// iframe of the client.
async function swap() {
	for (const { pkg, live } of SERVED) {
		const old = `${live}.old`;
		await rm(abs(pkg, old), {
			recursive: true, force: true, 
		});
		await rename(abs(pkg, live), abs(pkg, old));
		await rename(abs(pkg, STAGING), abs(pkg, live));
		await rm(abs(pkg, old), {
			recursive: true, force: true, 
		});
	}
}

// All-or-nothing: build everything (client, web, desktop) into staging first; a
// failure anywhere leaves the live site untouched and the version unpersisted.
// Only once it all compiles do we swap - the single step that touches live.
try {
	await build();
} catch (err) {
	console.error(
		`\n[staged-build] build failed - live site untouched, version not persisted.\n  ${err.message}`,
	);
	await cleanStaging();
	process.exit(1);
}

await swap();

console.log('[staged-build] verified and swapped into live dist.');
