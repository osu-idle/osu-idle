import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { serveStatic } from '@hono/node-server/serve-static';
import { ZodError } from 'zod';
import { clientUrl, isProd } from './env';
import { i18nMiddleware } from './i18n';
import { __ } from '@osu-idle/shared/i18n/translate';
import { UPLOAD_DIR, UPLOAD_ROUTE } from './uploads';
import { usersRoutes } from './routes/users';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { newsRoutes } from './routes/news';
import { scoresRoutes } from './routes/scores';
import { charactersRoutes } from './routes/characters';
import { statsRoutes } from './routes/stats';
import { rankingRoutes } from './routes/ranking';
import { beatmapsRoutes } from './routes/beatmap';

// In dev also accept the web app's own Vite origin (port 5174) - it's normally
// reached through the game's /web proxy (CLIENT_URL), but opening it directly is
// common while iterating on the web platform. Prod stays locked to CLIENT_URL.
const allowedOrigins = isProd ? clientUrl : [clientUrl, 'http://localhost:5174'];

// Versioned API surface. Mount future feature routers here.
const v1 = new Hono()
	.route('/stats', statsRoutes)
	.route('/users', usersRoutes)
	.route('/beatmap', beatmapsRoutes)
	.route('/characters', charactersRoutes)
	.route('/ranking', rankingRoutes)
	.route('/scores', scoresRoutes)
	.route('/auth', authRoutes)
	.route('/me', meRoutes)
	.route('/news', newsRoutes);

// Built as one chained expression so the route schema is captured in the type
// of `app`; `AppType` is then consumed by the client's typed RPC client to
// match the API's exact request/response types with no duplication.
const app = new Hono()
	.use('*', logger())
	.use('*', cors({ origin: allowedOrigins, credentials: true }))
	.use('*', i18nMiddleware)
	.get('/health', c => c.json({ status: 'ok' }))
	// Serve uploaded media (news cover images) from disk.
	.use(`${UPLOAD_ROUTE}/*`, serveStatic({
		root: UPLOAD_DIR,
		rewriteRequestPath: path => path.replace(new RegExp(`^${UPLOAD_ROUTE}`), ''),
	}))
	.route('/v1', v1);

app.notFound(c => c.json({ error: __('Not found') }, 404));

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return c.json({ error: err.message }, err.status);
	}
	if (err instanceof ZodError) {
		return c.json({ error: 'Validation failed', issues: err.issues }, 400);
	}
	console.error(err);
	return c.json({ error: 'Internal server error' }, 500);
});

export { app };

/** The shape of the API, consumed by the client's RPC client for end-to-end types. */
export type AppType = typeof app;
