import {
	beforeAll,
	describe,
	it,
	expect,
} from 'vitest';
import type {
	Database,
	SqlJsStatic,
} from 'sql.js';
import initSqlJs from 'sql.js';
import { createRequire } from 'node:module';
import { migrate } from '@osu-idle/client/db/migrations';
import { Skills } from '@osu-idle/shared/skills';
import { xpToLevel } from '@osu-idle/shared/sim/skills/xp';

const require = createRequire(import.meta.url);

let SQL: SqlJsStatic;

beforeAll(async () => {
	SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
});

/** How many migrations this branch found already applied - the database a player
 *  is upgrading from, with the guest lineage on positive ids, empty lifetime
 *  totals and scores graded with the old top letter. */
const APPLIED = 8;

const oldDatabase = (): Database => {
	const db = new SQL.Database();
	const skillCols = Skills.flatMap(s => [
		`${s} INTEGER DEFAULT 0`,
		`${s}XP INTEGER DEFAULT 0`,
		`${s}Upgrades INTEGER DEFAULT 0`,
		`${s}Overdrive REAL DEFAULT 0`,
		`${s}Prestige INTEGER DEFAULT 0`,
		`${s}TotalXp INTEGER DEFAULT 0`,
	]);
	db.run(`CREATE TABLE character (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT,
		${skillCols.join(', ')},
		overallTotalXp INTEGER DEFAULT 0,
		overallLevel INTEGER DEFAULT 0,
		generation INTEGER DEFAULT 1,
		local INTEGER DEFAULT 0
	);`);
	db.run(`CREATE TABLE score (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		characterId INTEGER, beatmapId INTEGER, score INTEGER, accuracy REAL,
		grade TEXT, pp REAL, playedAt INTEGER
	);`);
	for (const best of ['score_best', 'score_best_pp'])
		db.run(`CREATE TABLE ${best} (
			characterId INTEGER NOT NULL, beatmapId INTEGER NOT NULL, scoreId INTEGER NOT NULL,
			PRIMARY KEY (characterId, beatmapId)
		);`);
	db.run(`PRAGMA user_version = ${APPLIED}`);
	return db;
};

const rows = (db: Database, sql: string) => db.exec(sql)[0]?.values ?? [];
const one = (db: Database, sql: string) => rows(db, sql)[0]?.[0];

describe('client database migrations', () => {
	it('moves the local lineage below zero, with its scores', () => {
		const db = oldDatabase();
		db.run('INSERT INTO character (id, name, local, generation) VALUES (1, \'Guest\', 1, 1);');
		db.run('INSERT INTO character (id, name, local, generation) VALUES (2, \'Second\', 1, 2);');
		// a cached server character keeping the same id as the second generation
		db.run('INSERT INTO character (id, name, local) VALUES (3, \'Online\', 0);');
		db.run(`INSERT INTO score (characterId, beatmapId, score, accuracy, grade, pp, playedAt)
			VALUES (1, 10, 900000, 0.98, 'S', 100, 1), (2, 10, 950000, 0.99, 'X', 120, 2),
				(3, 10, 990000, 0.995, 'X', 130, 3);`);

		migrate(db);

		expect(rows(db, 'SELECT id, name FROM character ORDER BY id')).toEqual([
			[-2, 'Second'], [-1, 'Guest'], [3, 'Online'],
		]);
		expect(rows(db, 'SELECT characterId FROM score ORDER BY characterId')).toEqual([
			[-2], [-1], [3],
		]);
		// the newest generation is the one that stays live across reloads
		expect(one(db, 'SELECT id FROM character WHERE current = 1')).toBe(-2);
	});

	it('backfills the lifetime totals the rebirth gate reads', () => {
		const db = oldDatabase();
		db.run(`INSERT INTO character (id, name, local, accuracy, accuracyXP, speed, speedXP)
			VALUES (1, 'Guest', 1, 40, 500, 30, 250);`);

		migrate(db);

		const expected = Math.round(xpToLevel(40) + 500);
		expect(one(db, 'SELECT accuracyTotalXp FROM character')).toBe(expected);
		expect(one(db, 'SELECT overallTotalXp FROM character'))
			.toBe(expected + Math.round(xpToLevel(30) + 250));
		expect(one(db, 'SELECT overallLevel FROM character') as number).toBeGreaterThan(0);
	});

	it('renames the old top grade and re-picks the best on accuracy', () => {
		const db = oldDatabase();
		db.run('INSERT INTO character (id, name, local) VALUES (1, \'Guest\', 1);');
		// same capped score, the divine one only wins on accuracy
		db.run(`INSERT INTO score (id, characterId, beatmapId, score, accuracy, grade, pp, playedAt)
			VALUES (1, 1, 10, 1000000, 1.0, 'X', 100, 1),
				(2, 1, 10, 1000000, 1.00667, 'Z', 100, 2);`);

		migrate(db);

		expect(rows(db, 'SELECT id, grade FROM score ORDER BY id')).toEqual([[1, 'X'], [2, 'XX']]);
		expect(one(db, 'SELECT scoreId FROM score_best')).toBe(2);
	});
	it('gives memory somewhere to record that its training was spent', () => {
		const db = oldDatabase();
		db.run('INSERT INTO character (id, name, local) VALUES (1, \'Guest\', 1);');
		db.run(`INSERT INTO score (id, characterId, beatmapId, score, accuracy, grade, pp, playedAt)
			VALUES (1, 1, 10, 900000, 0.98, 'S', 50, 100),
				(2, 1, 10, 950000, 0.99, 'S', 60, 500),
				(3, 1, 10, 980000, 0.99, 'S', 70, 1500);`);

		migrate(db);

		// nothing prestiged yet, so every play still trains
		expect(one(db, 'SELECT memoryResetAt FROM character WHERE id = -1')).toBe(0);
		const since = (t: number) => one(db,
			`SELECT COUNT(*) FROM score WHERE characterId = -1 AND beatmapId = 10 AND playedAt >= ${t}`);
		expect(since(0)).toBe(3);
		// after a reset the earlier plays stop counting, but the scores remain
		expect(since(1000)).toBe(1);
		expect(one(db, 'SELECT COUNT(*) FROM score')).toBe(3);
	});
});