/**
 * Drop the flag that says the ranking sets are built, so the server rebuilds
 * them from MySQL on its next boot.
 *
 * The sets are keyed by character and hold values read out of the database. A
 * restore moves that database underneath them, so without this the boards keep
 * serving numbers no row backs up any more.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: 'packages/server/.env' });

const { default: Redis } = await import('ioredis');

// mirrors packages/server/src/env.ts + rankings.ts
const prefix = 'osu-idle:prod:';
const SCHEMA = 7;

const redis = new Redis({
	host: process.env.REDIS_HOST ?? '127.0.0.1',
	port: Number(process.env.REDIS_PORT ?? 6379),
	password: process.env.REDIS_PASSWORD || undefined,
	db: Number(process.env.REDIS_DB ?? 0),
});

const built = `${prefix}rankmeta:built:v${SCHEMA}`;
const removed = await redis.del(built);
console.log(`rankings: ${removed ? 'cleared' : 'already clear'} ${built}`);

// the rebuild wipes ranking:* itself, but clear it now so nothing serves stale
// numbers in the window between the server starting and the rebuild finishing
let cursor = '0', wiped = 0;
do {
	const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}ranking:*`, 'COUNT', 500);
	cursor = next;
	if (keys.length) {
		await redis.del(...keys);
		wiped += keys.length;
	}
} while (cursor !== '0');

console.log(`rankings: ${wiped} keys dropped - rebuilt on the next boot`);
await redis.quit();
