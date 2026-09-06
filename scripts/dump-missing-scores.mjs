/**
 * Dump the scores a snapshot predates, as JSON for the replay to walk.
 *
 * Taken at rollback time, not in advance: players keep playing right up to the
 * moment the server stops, and a dump made an hour earlier quietly drops every
 * score set since. Run this with the server already down, so the set is closed.
 *
 * The boundary comes out of the snapshot itself rather than being passed in -
 * whatever the highest score id in that file is, everything above it is what
 * the restore is about to lose.
 *
 *   node scripts/dump-missing-scores.mjs <snapshot.sql> <out.json>
 */
import { spawnSync } from 'node:child_process';
import {
	createReadStream,
	existsSync,
	writeFileSync,
} from 'node:fs';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: 'packages/server/.env' });

const [snapshot, out] = process.argv.slice(2);
if (!snapshot || !out || !existsSync(snapshot)) {
	console.error('usage: dump-missing-scores.mjs <snapshot.sql> <out.json>');
	process.exit(1);
}

/** Highest id in the snapshot's `score` table. */
const lastScoreId = async () => {
	const rl = createInterface({
		input: createReadStream(snapshot), crlfDelay: Infinity,
	});
	let inScore = false, max = 0;
	for await (const line of rl) {
		if (line.startsWith('INSERT INTO `score` VALUES')) inScore = true;
		else if (line.startsWith('INSERT INTO ')) inScore = false;
		if (inScore && line.startsWith('(')) {
			const m = /^\((\d+),/.exec(line);
			if (m && Number(m[1]) > max) max = Number(m[1]);
		}
	}
	rl.close();
	return max;
};

const need = (key) => {
	const v = process.env[key];
	if (!v) {
		console.error(`dump: ${key} is not set in packages/server/.env`);
		process.exit(1);
	}
	return v;
};

const after = await lastScoreId();
if (!after) {
	console.error(`dump: found no score rows in ${snapshot} - refusing to guess`);
	process.exit(1);
}
console.log(`dump: snapshot ends at score ${after}; taking everything above it`);

const res = spawnSync('mysql', [
	'-h', need('DB_HOST'), '-P', process.env.DB_PORT ?? '3306',
	'-u', need('DB_USER'), need('DB_NAME'), '--batch', '--raw',
	'-e', `SELECT * FROM score WHERE id > ${after} ORDER BY played_at, id`,
], {
	env: {
		...process.env, MYSQL_PWD: need('DB_PASSWORD'),
	},
	encoding: 'utf8',
	maxBuffer: 1 << 28,
});
if (res.status !== 0) {
	console.error(res.stderr);
	process.exit(1);
}

const [head, ...lines] = res.stdout.trim().split('\n');
const cols = head.split('\t');
const rows = lines.filter(Boolean).map(l => Object.fromEntries(
	l.split('\t').map((v, i) => [cols[i], v === 'NULL' ? null : v]),
));
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`dump: ${rows.length} scores written to ${out}`);
