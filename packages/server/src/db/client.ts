import {
	drizzle,
	type MySql2Database,
} from 'drizzle-orm/mysql2';
import {
	createPool,
	type Pool,
} from 'mysql2';
import {
	dbName,
	env,
} from '../env';

// Shared connection settings. `timezone: 'Z'` pins the driver to UTC so
// DATETIME/TIMESTAMP columns convert to/from JS `Date` as UTC instants -
// independent of the Node process's local `TZ`. The DB stores UTC, so a
// score's `playedAt.getTime()` is a true epoch and the client's relative
// "time ago" stays correct everywhere.
// `maxIdle` < `connectionLimit` so burst connections close after `idleTimeout`
// instead of staying open forever - the process runs as a 12-worker pm2
// cluster, so per-worker connections multiply against MySQL's global cap.
const connection = {
	host: env.DB_HOST,
	port: env.DB_PORT,
	user: env.DB_USER,
	password: env.DB_PASSWORD,
	timezone: 'Z',
	connectionLimit: 6,
	maxIdle: 2,
	idleTimeout: 60_000,
} as const;

// Explicit type annotations (rather than inferred) so the package can emit
// portable .d.ts for its app type - inferred mysql2/drizzle types reference
// deep internal paths that aren't nameable across packages.
export const pool: Pool = createPool({
	...connection, database: dbName,
});

// No relational `schema` is passed: the codebase uses the query-builder API
// (`db.select().from(...)`) exclusively, and importing the schema modules here
// would create a cycle (schema files co-locate their queries and import `db`).
export const db: MySql2Database<Record<string, never>> = drizzle(pool, {
	mode: 'default',
	casing: 'snake_case',
});