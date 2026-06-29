import 'dotenv/config';
import { z } from 'zod';

/**
 * Validated runtime configuration. Parsed once at boot; a missing or malformed
 * variable aborts startup with a readable error instead of failing deep inside
 * a request later.
 */
const schema = z.object({
	NODE_ENV: z.enum(['development', 'production']).default('development'),
	// Dev and prod must never share a port - otherwise a running prod (systemd)
	// service holds the port a local `npm run dev` needs. Resolved per-env below.
	PORT: z.coerce.number().int().positive().default(3873),
	PORT_PROD: z.coerce.number().int().positive().default(3874),
	// Client origin, per-env (resolved below) - used for CORS and the OAuth
	// redirect. Dev and prod differ, but share one .env, so both are declared.
	CLIENT_URL: z.url().default('http://localhost:5173'),
	CLIENT_URL_PROD: z.url().default('https://osu.idle.rhythmgamers.net'),

	DB_HOST: z.string().min(1),
	DB_PORT: z.coerce.number().int().positive().default(3306),
	DB_USER: z.string().min(1),
	DB_PASSWORD: z.string(),
	DB_NAME: z.string().min(1).default('idle'),
	DB_NAME_DEV: z.string().min(1).default('idle_test'),

	// osu! OAuth application (https://osu.ppy.sh/home/account/edit → OAuth)
	OSU_CLIENT_ID: z.string().min(1),
	OSU_CLIENT_SECRET: z.string().min(1),

	// Secret for signing our own session + CSRF-state JWTs.
	JWT_SECRET: z.string().min(1),

	// Redis holds the cross-process play state (pending plays, online/playing
	// presence, session strain) so the API can run as a pm2 cluster. Defaults
	// target a local redis-server; dev and prod are isolated by logical DB below.
	REDIS_HOST: z.string().min(1).default('127.0.0.1'),
	REDIS_PORT: z.coerce.number().int().positive().default(6379),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_DB: z.coerce.number().int().min(0).default(0),
	
	MAP_FEED_WEBHOOK: z.string(),
	USER_FEED_WEBHOOK: z.string(),
	ERROR_FEED_WEBHOOK: z.string(),

	// MaxMind GeoLite2-City database, used to place online players on the world
	// map (anonymous, coarse) and derive their timezone. Optional: without it the
	// map/timezone features degrade to country-level. The file is provisioned out
	// of band (download + periodic refresh from MaxMind).
	GEOIP_DB: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
	console.error('❌ Invalid environment configuration:');
	console.error(parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';

/**
 * Listening port, resolved per-environment so dev (3873) and prod (3874) never
 * collide - the prod systemd service and a local `npm run dev` can run side by
 * side. The reverse proxy for api.osu.idle.rhythmgamers.net targets the prod port.
 */
export const port = isProd ? env.PORT_PROD : env.PORT;

/**
 * The client app origin, resolved per-environment so a single shared `.env` can't
 * leave prod trusting the dev (localhost) origin - which would break CORS and the
 * OAuth redirect for the live site.
 */
export const clientUrl = isProd ? env.CLIENT_URL_PROD : env.CLIENT_URL;

/**
 * Database name, resolved from environment: the dev database (`dev`) everywhere
 * except production, where the real `DB_NAME` is used. Keeps prod data from ever
 * being touched by a dev/test run that forgot to set NODE_ENV.
 */
export const dbName = isProd ? env.DB_NAME : env.DB_NAME_DEV;

/**
 * This Redis is shared with many other projects on the host, so isolation comes
 * from {@link redisKeyPrefix} - every key this app touches is namespaced (a bare
 * `pending:<id>` could collide with another project, and a logical DB index is no
 * defence: there are only 16, nobody coordinates them, and most tooling assumes
 * db 0). The per-env prefix also keeps a local dev run apart from prod. The DB
 * index stays configurable (default 0) only in case the host has its own
 * per-project DB convention to slot into.
 */
export const redisDb = env.REDIS_DB;
export const redisKeyPrefix = isProd ? 'osu-idle:prod:' : 'osu-idle:dev:';

/**
 * Public origin of this API. Derived (not configured) because it depends on
 * dev vs prod - keeping it in sync by hand would be a footgun. Used to build
 * the osu! OAuth redirect URI, which must exactly match a registered callback.
 */
export const apiBaseUrl = isProd
	? 'https://api.osu.idle.rhythmgamers.net'
	: `http://localhost:${port}`;

/** osu! OAuth callback (both dev + prod variants are registered on the app). */
export const OSU_REDIRECT_URI = `${apiBaseUrl}/v1/auth/osu/callback`;

/** Origin the desktop renderer reports (it loads its bundle from a registered
 *  `app://` scheme). Allowed through CORS so the Bearer-authed app can call us. */
export const DESKTOP_ORIGIN = 'app://idle';

/** Session cookie is Secure only over https (prod). */
export const cookieSecure = isProd;
