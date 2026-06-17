import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, toUserDTO } from '../db/schema/user';
import { clientUrl, cookieSecure } from '../env';
import { authorizeUrl, exchangeCode, fetchOsuUser } from '../auth/osu';
import { signSession, signState, verifyState } from '../auth/jwt';
import { requireAuth, SESSION_COOKIE } from '../auth/middleware';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, seconds

/**
 * osu! OAuth (authorization-code) used only to verify/register the player. On
 * success we set our own HttpOnly session cookie; the client never touches the
 * osu! API afterwards. Chained so the routes land in the exported AppType.
 */
export const authRoutes = new Hono()
	// Popup entry point → osu! authorize (with signed CSRF state).
	.get('/osu/login', async c => {
		return c.redirect(authorizeUrl(await signState()));
	})

	// osu! redirects back here with ?code&state.
	.get('/osu/callback', async c => {
		const code = c.req.query('code');
		const state = c.req.query('state');
		if (!code || !state) throw new HTTPException(400, { message: 'Missing code or state' });

		try {
			await verifyState(state);
		} catch {
			throw new HTTPException(400, { message: 'Invalid or expired state' });
		}

		const accessToken = await exchangeCode(code);
		const osu = await fetchOsuUser(accessToken);

		await db
			.insert(users)
			.values({ id: osu.id, username: osu.username, avatarUrl: osu.avatar_url, country: osu.country_code })
			.onDuplicateKeyUpdate({ set: { username: osu.username, avatarUrl: osu.avatar_url, country: osu.country_code } });

		setCookie(c, SESSION_COOKIE, await signSession({ id: osu.id, username: osu.username }), {
			httpOnly: true,
			sameSite: 'Lax',
			secure: cookieSecure,
			path: '/',
			maxAge: SESSION_MAX_AGE,
		});

		// Back to the same-origin /web page, which pings the game and closes.
		return c.redirect(`${clientUrl}/web/auth/callback`);
	})

	// Current session → user profile (cookie-authenticated).
	.get('/me', requireAuth, async c => {
		const [row] = await db.select().from(users).where(eq(users.id, c.get('userId'))).limit(1);
		if (!row) throw new HTTPException(401, { message: 'User not found' });
		return c.json(toUserDTO(row));
	})

	.post('/logout', c => {
		deleteCookie(c, SESSION_COOKIE, { path: '/' });
		return c.json({ ok: true });
	});
