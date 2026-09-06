/**
 * Snapshot the production database, before a deploy migrates it.
 *
 * The nightly backup keeps one day and rotates at 23:42, so whether a release
 * has a snapshot in front of it is down to what time it went out. This one is
 * taken by the deploy itself and never rotated - the point is to still have it
 * weeks later, when a bug turns up that only a pre-release row can settle.
 *
 * It runs before the version bump, so the version in package.json is still the
 * one currently live: the snapshot is named for the build the data belongs to,
 * not the one about to replace it.
 *
 * Run through `npm run backup:prod`. Exits non-zero if the dump fails or lands
 * empty, so a deploy that cannot take one does not go on to migrate.
 */
import {
	execFileSync,
	spawnSync,
} from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	statSync,
} from 'node:fs';
import {
	dirname,
	join,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: 'packages/server/.env' });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// the version still on disk is the one being replaced - see the note above
const { version } = require('../package.json');
const dir = process.env.RELEASE_BACKUP_DIR ?? join(root, 'backups');

const need = (key) => {
	const v = process.env[key];
	if (!v) {
		console.error(`backup: ${key} is not set in packages/server/.env`);
		process.exit(1);
	}
	return v;
};

const db = need('DB_NAME');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = join(dir, `${db}-${version}-${stamp}.sql.gz`);

if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

console.log(`backup: dumping ${db} to ${file}`);

// the password goes through the environment, never the argument list, so it
// stays out of ps and out of this script's own logging
const res = spawnSync('sh', ['-c',
	'mysqldump --single-transaction --quick --routines --events '
	+ '-h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" | gzip > "$OUT"',
], {
	stdio: ['ignore', 'inherit', 'inherit'],
	env: {
		...process.env,
		MYSQL_PWD: need('DB_PASSWORD'),
		DB_HOST: need('DB_HOST'),
		DB_PORT: process.env.DB_PORT ?? '3306',
		DB_USER: need('DB_USER'),
		DB_NAME: db,
		OUT: file,
	},
});

if (res.status !== 0) {
	console.error(`backup: mysqldump failed (exit ${res.status}) - not migrating`);
	process.exit(1);
}

// a dump that fails midway still leaves a valid gzip, so check it holds a table
const size = statSync(file).size;
try {
	execFileSync('sh', ['-c', `gzip -dc "${file}" | grep -qm1 'CREATE TABLE'`]);
} catch {
	console.error(`backup: ${file} has no tables in it - not migrating`);
	process.exit(1);
}

console.log(`backup: ${(size / 1024 / 1024).toFixed(1)} MB written`);
