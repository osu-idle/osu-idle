import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { isAdmin } from '@osu-idle/shared/admin';
import { requireAuth } from './middleware';

/** Require a valid session whose user is an admin (see `ADMIN_USER_IDS`). */
export const requireAdmin = createMiddleware<{ Variables: { userId: number } }>(async (c, next) => {
	// Reuse requireAuth to populate `userId`, then gate on admin membership.
	await requireAuth(c, async () => {
		if (!isAdmin(c.get('userId'))) throw new HTTPException(403, { message: 'Forbidden' });
		await next();
	});
});
