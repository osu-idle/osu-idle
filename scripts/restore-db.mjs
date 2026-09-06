/**
 * Restore a snapshot over the production database.
 *
 * The one irreversible step in a rollback, so it is deliberately small and
 * loud: it refuses a file that is not a mysqldump, and it refuses to run
 * against anything but the configured production database.
 *
 *   node scripts/restore-db.mjs backups/<snapshot>.sql
 */
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	statSync,
} from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: 'packages/server/.env' });

const file = process.argv[2];
if (!file || !existsSync(file)) {
	console.error(`restore: no such file: ${file ?? '(none given)'}`);
	process.exit(1);
}

const need = (key) => {
	const v = process.env[key];
	if (!v) {
		console.error(`restore: ${key} is not set in packages/server/.env`);
		process.exit(1);
	}
	return v;
};

const db = need('DB_NAME');

// a truncated or wrong file would drop the tables and then fail to refill them.
// the server runs MariaDB, whose dumps say so in the header - accept either.
const head = spawnSync('sh', ['-c', `head -c 4096 "${file}"`], { encoding: 'utf8' }).stdout ?? '';
if (!/(MySQL|MariaDB) dump/.test(head)) {
	console.error(`restore: ${file} does not look like a database dump - refusing`);
	process.exit(1);
}
// and it must be a whole database, not a single table
if (!head.includes('DROP TABLE') && !/^-- Table structure/m.test(head)) {
	console.error(`restore: ${file} carries no table definitions - refusing`);
	process.exit(1);
}

const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
console.log(`restore: loading ${file} (${mb} MB) into ${db}`);

const load = 'mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" < "$IN"';
const res = spawnSync('sh', ['-c', load], {
	stdio: ['ignore', 'inherit', 'inherit'],
	env: {
		...process.env,
		MYSQL_PWD: need('DB_PASSWORD'),
		DB_HOST: need('DB_HOST'),
		DB_PORT: process.env.DB_PORT ?? '3306',
		DB_USER: need('DB_USER'),
		DB_NAME: db,
		IN: file,
	},
});

if (res.status !== 0) {
	console.error(`restore: mysql exited ${res.status} - the database is`
		+ ' half restored, do not start the server');
	process.exit(1);
}
console.log('restore: done');
