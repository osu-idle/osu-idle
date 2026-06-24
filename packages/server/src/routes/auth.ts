import { Hono } from 'hono';
import {
	setCookie,
	deleteCookie,
} from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
	users,
	toUserDTO,
} from '../db/schema/user';
import {
	clientUrl,
	cookieSecure,
} from '../env';
import {
	authorizeUrl,
	exchangeCode,
	fetchOsuUser,
} from '../auth/osu';
import {
	signSession,
	signState,
	verifyState,
} from '../auth/jwt';
import {
	requireAuth,
	SESSION_COOKIE,
} from '../auth/middleware';
import {
	storeHandoff,
	takeHandoff,
	claimStateNonce,
} from '../auth/handoff';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, seconds

/**
 * osu! OAuth (authorization-code) used only to verify/register the player. On
 * success we set our own HttpOnly session cookie; the client never touches the
 * osu! API afterwards. Chained so the routes land in the exported AppType.
 */
export const authRoutes = new Hono()
	// Entry point → osu! authorize (with signed CSRF state). `?client=desktop`
	// tags the round-trip so the callback hands the session to the desktop app
	// instead of setting a browser cookie.
	.get('/osu/login', async c => {
		const client = c.req.query('client') === 'desktop' ? 'desktop' : 'web';
		// Desktop generates a one-time poll code and polls for the callback's
		// result; carry it (signed) through the round-trip.
		const poll = client === 'desktop' ? c.req.query('poll') : undefined;
		return c.redirect(authorizeUrl(await signState(client, poll)));
	})

	// osu! redirects back here with ?code&state.
	.get('/osu/callback', async c => {
		const code = c.req.query('code');
		const state = c.req.query('state');
		if (!code || !state) throw new HTTPException(400, { message: 'Missing code or state' });

		let client: 'web' | 'desktop';
		let nonce: string;
		let poll: string | undefined;
		try {
			({ client, nonce, poll } = await verifyState(state));
		} catch {
			throw new HTTPException(400, { message: 'Invalid or expired state' });
		}

		// The system browser tab can re-fire this callback (reload, back/forward,
		// prefetch) after the deep-link redirect; osu! revokes the auth code on the
		// first exchange, so a second attempt would 500. Claim the nonce once and
		// send any replay to a benign page - the first hit already finished auth.
		if (!await claimStateNonce(nonce)) return c.redirect(`${clientUrl}/web/auth/callback`);

		const accessToken = await exchangeCode(code);
		const osu = await fetchOsuUser(accessToken);

		await db
			.insert(users)
			.values({
				id: osu.id, username: osu.username, avatarUrl: osu.avatar_url, country: osu.country_code, 
			})
			.onDuplicateKeyUpdate({
				set: {
					username: osu.username, avatarUrl: osu.avatar_url, country: osu.country_code, 
				}, 
			});

		const session = await signSession({
			id: osu.id, username: osu.username, 
		});

		// Desktop: a browser cookie wouldn't reach the app, so stash the session
		// under the poll code the app generated; the app polls /osu/desktop/exchange
		// for it. The browser lands on the web platform's "signed in" page.
		if (client === 'desktop') {
			if (poll) await storeHandoff(poll, session);
			return c.redirect(`${clientUrl}/web/auth/desktop`);
		}

		setCookie(c, SESSION_COOKIE, session, {
			httpOnly: true,
			sameSite: 'Lax',
			secure: cookieSecure,
			path: '/',
			maxAge: SESSION_MAX_AGE,
		});

		// Back to the same-origin /web page, which pings the game and closes.
		return c.redirect(`${clientUrl}/web/auth/callback`);
	})

	// Desktop OAuth hand-off: swap a one-time code for the session token. The app
	// then holds the token and sends it as a Bearer header on every API call.
	.post('/osu/desktop/exchange', async c => {
		const { code } = await c.req.json().catch(() => ({ code: undefined })) as { code?: string };
		if (!code) throw new HTTPException(400, { message: 'Missing code' });
		const token = await takeHandoff(code);
		if (!token) throw new HTTPException(401, { message: 'Invalid or expired code' });
		return c.json({ token });
	})

	// Current session → user profile (cookie- or Bearer-authenticated).
	.get('/me', requireAuth, async c => {
		const [row] = await db.select().from(users).where(eq(users.id, c.get('userId'))).limit(1);
		if (!row) throw new HTTPException(401, { message: 'User not found' });
		return c.json(toUserDTO(row));
	})

	.post('/logout', c => {
		deleteCookie(c, SESSION_COOKIE, { path: '/' });
		return c.json({ ok: true });
	});
