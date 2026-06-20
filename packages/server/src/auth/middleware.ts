import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { verifySession } from './jwt';

export const SESSION_COOKIE = 'session';

/** The session JWT, from the HttpOnly cookie (web) or a `Bearer` header (the
 *  desktop app, which can't ride a cross-origin cookie and holds the token
 *  itself). Both carry the exact same session JWT - see {@link signSession}. */
function sessionToken(c: Context): string | undefined {
	const auth = c.req.header('Authorization');
	if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
	return getCookie(c, SESSION_COOKIE);
}

/** Require a valid session (cookie or Bearer); exposes the user id as `c.get('userId')`. */
export const requireAuth = createMiddleware<{ Variables: { userId: number } }>(async (c, next) => {
	const token = sessionToken(c);
	if (!token) throw new HTTPException(401, { message: 'Not authenticated' });

	try {
		const { uid } = await verifySession(token);
		c.set('userId', uid);
	} catch {
		throw new HTTPException(401, { message: 'Invalid session' });
	}

	await next();
});
