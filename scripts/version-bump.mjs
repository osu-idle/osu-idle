#!/usr/bin/env node
// Standalone version bump helper, run first by `deploy:prod`.
//
// It detects the current version (the "version" field of the root
// package.json is the source of truth), asks for a bump type, then rewrites
// the version in every workspace package.json and regenerates
// packages/shared/src/version.ts so VERSION is available at runtime everywhere.
// On an actual bump it commits the whole working tree (every pending change,
// not just the version files) and pushes to the current branch's remote: a
// build bump makes a "bump to version <x>" commit only,
// while major/minor/patch make a "release version <x>" commit plus an annotated
// v<x> tag pushed alongside it.
//
// Usage:
//   node scripts/version-bump.mjs            interactive prompt (enter = build)
//   node scripts/version-bump.mjs <type>     non-interactive (major|minor|patch|build|skip)
// In a non-TTY context with no argument it skips (keeps the current version),
// so an automated deploy never blocks on input.

import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const exec = promisify(execFile);
const git = (...args) => exec('git', args, { cwd: ROOT });

// Every package.json carrying a "version" field, kept in lockstep. The tests
// workspace has none and is intentionally left out.
const PACKAGE_JSONS = [
	'package.json',
	'packages/shared/package.json',
	'packages/server/package.json',
	'packages/client/package.json',
	'packages/web/package.json',
];

// Generated runtime carrier consumed via `@osu-idle/shared/version`.
const VERSION_TS = 'packages/shared/src/version.ts';

const BUMPS = {
	major: ([major]) => [major + 1, 0, 0, 0],
	minor: ([major, minor]) => [major, minor + 1, 0, 0],
	patch: ([major, minor, patch]) => [major, minor, patch + 1, 0],
	build: ([major, minor, patch, build]) => [major, minor, patch, build + 1],
};

// Accept a missing BUILD segment so a legacy MAJOR.MINOR.PATCH version migrates
// cleanly to MAJOR.MINOR.PATCH.BUILD on the first bump.
function parse(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/.exec(version.trim());
	if (!match) throw new Error(`Cannot parse version "${version}" (expected MAJOR.MINOR.PATCH.BUILD)`);
	return [match[1], match[2], match[3], match[4] ?? '0'].map(Number);
}

async function readRootVersion() {
	const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
	return pkg.version;
}

// Replace only the package's own top-level "version" field; dependency entries
// are keyed by package name, never "version", so they are untouched.
async function writeVersion(version) {
	for (const rel of PACKAGE_JSONS) {
		const path = join(ROOT, rel);
		const text = await readFile(path, 'utf8');
		const next = text.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
		if (next !== text) await writeFile(path, next);
	}
	await writeFile(join(ROOT, VERSION_TS), `export const VERSION = '${version}';`);
}

// The remote tracked by the current branch, falling back to origin / the first
// configured remote. Returns undefined if the repo has no remote.
async function currentRemote() {
	try {
		const branch = (await git('branch', '--show-current')).stdout.trim();
		const remote = (await git('config', '--get', `branch.${branch}.remote`)).stdout.trim();
		if (remote) return remote;
	} catch { /* no upstream configured */ }
	try {
		const remotes = (await git('remote')).stdout.split('\n').map(s => s.trim()).filter(Boolean);
		return remotes.includes('origin') ? 'origin' : remotes[0];
	} catch { /* not a git repo */ }
	return undefined;
}

// Commit all pending work (the bumped version files plus any other working-tree
// changes) and push it. A `build` bump is just a
// "bump to version <x>" commit; major/minor/patch make a "release version <x>"
// commit plus an annotated v<x> tag pushed alongside it. Each git step is
// best-effort: a failure (no git, existing tag, no push access) warns but never
// aborts the deploy that called us.
async function commitVersion(version, choice) {
	try {
		await git('rev-parse', '--is-inside-work-tree');
	} catch {
		stdout.write('Not a git repository - skipping commit.\n');
		return;
	}

	const tagged = choice !== 'build';
	const tag = `v${version}`;
	const message = tagged ? `release version ${version}` : `bump to version ${version}`;
	try {
		// Stage and commit the entire working tree, not just the version files:
		// a deploy rolls every pending change into the release commit. The bumped
		// version files guarantee the commit is never empty.
		await git('add', '--all');
		await git('commit', '-m', message);
		if (tagged) await git('tag', '-a', tag, '-m', message);
		stdout.write(tagged ? `Committed and tagged ${tag}.\n` : `Committed "${message}".\n`);
	} catch (err) {
		stdout.write(`Could not commit${tagged ? `/tag ${tag}` : ''}: ${(err.stderr || err.message).trim()}\n`);
		return;
	}

	const remote = await currentRemote();
	if (!remote) {
		stdout.write('No git remote - committed locally but not pushed.\n');
		return;
	}
	// Push the branch (so the remote advances) plus the tag when there is one,
	// rather than leaving the remote branch behind a dangling tagged commit.
	const branch = (await git('branch', '--show-current')).stdout.trim();
	const refs = [...(branch ? [branch] : []), ...(tagged ? [tag] : [])];
	if (refs.length === 0) {
		stdout.write('Detached HEAD with no tag - nothing to push.\n');
		return;
	}
	try {
		await git('push', remote, ...refs);
		stdout.write(`Pushed ${refs.join(' + ')} to ${remote}.\n`);
	} catch (err) {
		stdout.write(`Could not push ${refs.join(' + ')} to ${remote}: ${(err.stderr || err.message).trim()}\n`);
	}
}

async function promptBump(current) {
	const previews = Object.fromEntries(
		Object.entries(BUMPS).map(([type, bump]) => [type, bump(parse(current)).join('.')]),
	);
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		while (true) {
			stdout.write(
				`\nCurrent version: ${current}\n`
				+ `  [1] major  → ${previews.major}\n`
				+ `  [2] minor  → ${previews.minor}\n`
				+ `  [3] patch  → ${previews.patch}\n`
				+ `  [4] build  → ${previews.build}\n`
				+ `  [s] skip   → keep ${current}\n`,
			);
			// Enter (empty answer) defaults to a build bump.
			const answer = (await rl.question('Bump type [1/2/3/4/s] (enter = build): ')).trim().toLowerCase();
			const choice = {
				'': 'build',
				1: 'major', major: 'major',
				2: 'minor', minor: 'minor',
				3: 'patch', patch: 'patch',
				4: 'build', build: 'build',
				s: 'skip', skip: 'skip',
			}[answer];
			if (choice) return choice;
			stdout.write(`Unrecognised choice "${answer}".\n`);
		}
	} finally {
		rl.close();
	}
}

async function main() {
	const current = await readRootVersion();
	const arg = process.argv[2]?.toLowerCase();

	let choice;
	if (arg) {
		if (!(arg in BUMPS) && arg !== 'skip') {
			throw new Error(`Unknown bump type "${arg}" (expected major|minor|patch|skip)`);
		}
		choice = arg;
	} else if (stdin.isTTY) {
		choice = await promptBump(current);
	} else {
		stdout.write(`Non-interactive shell, keeping version ${current}.\n`);
		choice = 'skip';
	}

	if (choice === 'skip') {
		// Still rewrite, so a manually edited package.json and version.ts can't drift.
		await writeVersion(current);
		stdout.write(`Keeping version ${current}.\n`);
		return;
	}

	const next = BUMPS[choice](parse(current)).join('.');
	await writeVersion(next);
	stdout.write(`Bumped ${current} → ${next}.\n`);
	await commitVersion(next, choice);
}

main().catch(err => {
	console.error(err.message ?? err);
	process.exit(1);
});
