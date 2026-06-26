import type { Database } from 'sql.js';

/**
 * Schema migrations, applied in order on boot.
 *
 * Versioning rides on SQLite's `PRAGMA user_version`: it records how many
 * migrations have run, so each one applies exactly once per database. New
 * databases start at 0 and replay every migration (cheap, since there's no
 * data yet), which keeps the path uniform - there's no "fresh vs upgrade" fork.
 *
 * Each migration is a frozen snapshot: it embeds its own DDL rather than
 * referencing the live `table()` definitions, so editing a schema later never
 * silently changes what an old migration did.
 */
type Migration = (db: Database) => void;

/**
 * Personal-best tables were keyed by score `id`, so a new best inserted a fresh
 * row and the old marker lingered - `best()` then returned an arbitrary (in
 * practice, the earliest/worst) one. Re-key them on `(characterId, beatmapId)`
 * and recompute every character's best score / best pp from scratch.
 */
const recomputeBests: Migration = db => {
	db.run('DROP TABLE IF EXISTS score_best');
	db.run('DROP TABLE IF EXISTS score_best_pp');

	db.run(`CREATE TABLE score_best (
		characterId INTEGER NOT NULL,
		beatmapId   INTEGER NOT NULL,
		scoreId     INTEGER NOT NULL,
		PRIMARY KEY (characterId, beatmapId)
	);`);
	db.run(`CREATE TABLE score_best_pp (
		characterId INTEGER NOT NULL,
		beatmapId   INTEGER NOT NULL,
		scoreId     INTEGER NOT NULL,
		PRIMARY KEY (characterId, beatmapId)
	);`);

	// For each (character, beatmap) keep the row that nothing else beats:
	// higher value wins, ties broken by the earlier (smaller) id.
	db.run(`INSERT INTO score_best (characterId, beatmapId, scoreId)
		SELECT s.characterId, s.beatmapId, s.id FROM score s
		WHERE NOT EXISTS (
			SELECT 1 FROM score o
			WHERE o.characterId = s.characterId AND o.beatmapId = s.beatmapId
				AND (o.score > s.score OR (o.score = s.score AND o.id < s.id))
		);`);
	db.run(`INSERT INTO score_best_pp (characterId, beatmapId, scoreId)
		SELECT s.characterId, s.beatmapId, s.id FROM score s
		WHERE NOT EXISTS (
			SELECT 1 FROM score o
			WHERE o.characterId = s.characterId AND o.beatmapId = s.beatmapId
				AND (o.pp > s.pp OR (o.pp = s.pp AND o.id < s.id))
		);`);
};

const addOnlineId: Migration = db => {
	const exists = db.exec(`
		SELECT EXISTS (
			SELECT 1
			FROM pragma_table_info('score')
			WHERE name = 'onlineId'
		);
	`)[0].values[0][0] as number;

	if (exists) return;

	db.run('ALTER TABLE score ADD COLUMN onlineId INTEGER DEFAULT -1;');
	db.run('CREATE INDEX IF NOT EXISTS idx_score_online_id ON score(onlineId);');
};

const dedupeGuests: Migration = db => {
	const ids = db.exec(`
		SELECT * FROM character WHERE id != 1 AND name = 'Guest';
	`)[0]?.values?.map(c => c[0]);
	
	if (!ids || !ids.length) return;

	const keep = db.exec(
		'SELECT * FROM character WHERE name = \'Guest\' ORDER BY accuracy DESC',
	)[0]?.values[0][0];
	if (keep === undefined) return; // ignore
	if (keep !== 1) {
		db.run('DELETE FROM character WHERE id = 1');
		db.run('UPDATE character SET id = 1 WHERE id = ?', [keep]);
		db.run('UPDATE score SET characterId = 1 WHERE characterId = ?', [keep]);
		db.run('DELETE FROM score_best WHERE characterId = ?', [keep]);
		db.run('DELETE FROM score_best_pp WHERE characterId = ?', [keep]);
	}

	for (const id of ids) {
		if (id === keep) continue;
		db.run('UPDATE score SET characterId = 1 WHERE characterId = ?', [id]);
		db.run('DELETE FROM score_best WHERE characterId = ?', [id]);
		db.run('DELETE FROM score_best_pp WHERE characterId = ?', [id]);
		db.run('DELETE FROM character WHERE id = ?', [id]);
	}

	recomputeBests(db);
};

const removeScoreSetId: Migration = db => {
	// On a fresh database the live schema creates `score` without `setId`, so the
	// drop would fail with "no such column: setId". Only drop it if it's there.
	const exists = db.exec(`
		SELECT EXISTS (
			SELECT 1
			FROM pragma_table_info('score')
			WHERE name = 'setId'
		);
	`)[0].values[0][0] as number;

	if (!exists) return;

	db.run('ALTER TABLE score DROP COLUMN setId');
};

const addAddonsGameVersion: Migration = db => {
	// The addon table only exists once the add-ons scene has run (the registry
	// creates it, with gameVersion, on boot). Patch only an older table that was
	// created before the column existed; backfill blanks.
	const tableExists = db.exec(`
		SELECT EXISTS (
			SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'addon'
		);
	`)[0].values[0][0] as number;
	if (!tableExists) return;

	const hasColumn = db.exec(`
		SELECT EXISTS (
			SELECT 1 FROM pragma_table_info('addon') WHERE name = 'gameVersion'
		);
	`)[0].values[0][0] as number;
	if (hasColumn) return;

	db.run('ALTER TABLE addon ADD COLUMN gameVersion TEXT NOT NULL DEFAULT \'\';');
};

const migrations: Migration[] = [
	recomputeBests,
	addOnlineId,
	dedupeGuests,
	removeScoreSetId,
	addAddonsGameVersion,
];

/**
 * Apply every migration not yet recorded in `user_version`, then bump it.
 * Returns true if any migration ran, so the caller can persist the result.
 */
export function migrate(db: Database): boolean {
	const version = db.exec('PRAGMA user_version')[0].values[0][0] as number;
	console.log(`Current DB version v${version}`);
	for (let v = version; v < migrations.length; v++) {
		console.log(`Migrating db to v${v+1}...`);
		migrations[v](db);
		db.run(`PRAGMA user_version = ${v+1}`);
		console.log(`DB version v${v+1}`);
	}
	return version < migrations.length;
}
