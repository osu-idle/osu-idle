#!/usr/bin/env node

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

const PUBLIC_REMOTE = 'public';
const PUBLIC_BRANCH = 'main';
const PUBLIC_REF = `${PUBLIC_REMOTE}/${PUBLIC_BRANCH}`;

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

// A best-effort git step: run it, report failure, but never throw - so a
// missing remote or no push access warns instead of aborting the deploy.
async function gitTry(label, ...args) {
	try {
		await git(...args);
		return true;
	} catch (err) {
		stdout.write(`${label} failed: ${(err.stderr || err.message).trim()}\n`);
		return false;
	}
}

async function hasRemote(remote) {
	try {
		const remotes = (await git('remote')).stdout.split('\n').map(s => s.trim());
		return remotes.includes(remote);
	} catch {
		return false;
	}
}

// True when `ref` is already contained in develop's history (nothing of it to
// merge back). `--is-ancestor` exits 0 when it is, 1 when it is not.
async function isAncestor(ref) {
	try {
		await git('merge-base', '--is-ancestor', ref, 'HEAD');
		return true;
	} catch {
		return false;
	}
}

async function ensurePublicMergeable() {
	await git('fetch', PUBLIC_REMOTE, PUBLIC_BRANCH);
	if (await isAncestor(PUBLIC_REF)) return false;

	// `merge-tree` does a real three-way merge in memory and exits non-zero on
	// conflict, all without touching the index or working tree.
	try {
		await git('merge-tree', '--write-tree', 'HEAD', PUBLIC_REF);
	} catch (err) {
		throw new Error(
			`${PUBLIC_REF} has contributor commits that conflict with develop.\n`
            + 'Merge and resolve them by hand before releasing (nothing was changed).\n'
            + (err.stdout || err.stderr || '').trim(),
		);
	}
	return true;
}

// Commit the entire working tree (bumped version files plus any other pending
// change) onto develop. The version files guarantee the commit is never empty.
async function commitDevelop(message) {
	await git('add', '--all');
	await git('commit', '-m', message);
}

async function publishPublic(version) {
	const tag = `v${version}`;
	let commit;
	try {
		const tree = (await git('rev-parse', 'HEAD^{tree}')).stdout.trim();
		const parent = (await git('rev-parse', PUBLIC_REF)).stdout.trim();
		commit = (await git('commit-tree', tree, '-p', parent, '-m', `release version ${version}`)).stdout.trim();
	} catch (err) {
		stdout.write(`Could not build public release commit: ${(err.stderr || err.message).trim()}\n`);
		return;
	}

	if (!await gitTry('Push to public/main', 'push', PUBLIC_REMOTE, `${commit}:refs/heads/${PUBLIC_BRANCH}`)) return;
	await gitTry(`Push ${tag} to public`, 'push', PUBLIC_REMOTE, `${commit}:refs/tags/${tag}`);
	stdout.write(`Published ${tag} to ${PUBLIC_REF} (${commit.slice(0, 9)}).\n`);

	// Record the public commit as an ancestor of develop without changing
	// develop's tree, so the next `git merge public` here sees only contributor
	// commits. This merge lives on origin only; public never receives it.
	await gitTry('Record public release on develop', 'merge', '-s', 'ours', '--no-edit',
		'-m', `record public release ${tag}`, commit);
}

async function inGitRepo() {
	try {
		await git('rev-parse', '--is-inside-work-tree');
		return true;
	} catch {
		return false;
	}
}

// Commit the bump on develop, fold in contributor commits when a clean public
// merge is pending, and tag a release. Returns false only if the commit itself
// failed. The merge happens before the tag so v<x> covers the full released
// tree (contributor content plus this bump).
async function commitDevelopBump(version, release, mergePublic) {
	try {
		await commitDevelop(release ? `release version ${version}` : `bump to version ${version}`);
	} catch (err) {
		stdout.write(`Could not commit: ${(err.stderr || err.message).trim()}\n`);
		return false;
	}
	if (mergePublic) {
		await gitTry('Merge public contributions', 'merge', '--no-edit',
			'-m', `merge ${PUBLIC_REF} contributions`, PUBLIC_REF);
	}
	if (release) {
		await gitTry(`Tag v${version}`, 'tag', '-a', `v${version}`, '-m', `release version ${version}`);
		stdout.write(`Committed and tagged v${version}.\n`);
	} else {
		stdout.write(`Committed "bump to version ${version}".\n`);
	}
	return true;
}

// Push develop (and the release tag when given) to its origin remote.
async function pushDevelop(tag) {
	const remote = await currentRemote();
	if (!remote) {
		stdout.write('No git remote - committed locally but not pushed.\n');
		return;
	}
	const branch = (await git('branch', '--show-current')).stdout.trim();
	const refs = [...(branch ? [branch] : []), ...(tag ? [tag] : [])];
	if (refs.length) await gitTry(`Push ${refs.join(' + ')} to ${remote}`, 'push', remote, ...refs);
}

// Execute the final sequence of git commands after versions have been updated
// safely. Each git step past the pre-flight is best-effort: it warns but never
// aborts the deploy that called us.
async function commitVersion(version, release, toPublic, mergePublic) {
	if (!await commitDevelopBump(version, release, mergePublic)) return;
	await pushDevelop(release ? `v${version}` : null);

	if (toPublic) {
		await publishPublic(version);
		// publishPublic's `-s ours` record advanced develop; push it to origin.
		await pushDevelop(null);
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
			throw new Error(`Unknown bump type "${arg}" (expected major|minor|patch|build|skip)`);
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

	// Git Checks & Pre-flight
	const isGit = await inGitRepo();
	const release = choice !== 'build';
	let toPublic = false;
	let mergePublic = false;

	if (isGit && release) {
		toPublic = await hasRemote(PUBLIC_REMOTE);
		if (toPublic) {
			// Pre-flight before any mutation: a release refuses to start while public
			// holds conflicting contributor commits. Throws if conflict detected.
			mergePublic = await ensurePublicMergeable();
		}
	}

	// Now safe to mutate the working tree
	const next = BUMPS[choice](parse(current)).join('.');
	await writeVersion(next);
	stdout.write(`Bumped ${current} → ${next}.\n`);

	if (isGit) {
		await commitVersion(next, release, toPublic, mergePublic);
	} else {
		stdout.write('Not a git repository - skipped commit.\n');
	}
}

main().catch(err => {
	console.error(err.message ?? err);
	process.exit(1);
});