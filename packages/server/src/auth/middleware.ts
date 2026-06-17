import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { verifySession } from './jwt';

export const SESSION_COOKIE = 'session';

/** Require a valid session cookie; exposes the user id as `c.get('userId')`. */
export const requireAuth = createMiddleware<{ Variables: { userId: number } }>(async (c, next) => {
	const token = getCookie(c, SESSION_COOKIE);
	if (!token) throw new HTTPException(401, { message: 'Not authenticated' });

	try {
		const { uid } = await verifySession(token);
		c.set('userId', uid);
	} catch {
		throw new HTTPException(401, { message: 'Invalid session' });
	}

	await next();
});
