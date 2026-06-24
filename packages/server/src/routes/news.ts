import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
	and,
	desc,
	eq,
} from 'drizzle-orm';
import { z } from 'zod';
import {
	newsCreateBody,
	newsUpdateBody,
} from '@osu-idle/shared/news';
import { db } from '../db/client';
import {
	news,
	toNewsDTO,
} from '../db/schema/news';
import { users } from '../db/schema/user';
import { requireAdmin } from '../auth/admin';
import { saveUploadedImage } from '../uploads';

const idParam = z.coerce.number().int().positive();

// Re-throw the ZodError so the app's onError handler returns our standard
// `{ error: 'Validation failed', issues }` 400 - keeping one validation-error
// shape across manually-parsed and zValidator-typed routes.
const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => {
		if (!result.success) throw result.error;
	});

/** Join the author's username onto a news row and map to the DTO. */
async function withAuthor(row: typeof news.$inferSelect) {
	const [author] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, row.authorId))
		.limit(1);
	return toNewsDTO(row, author?.username ?? 'unknown');
}

/**
 * News articles. Reads are public but only expose published posts; writes are
 * admin-only (see `requireAdmin`). Drafts are visible only through the `/admin`
 * endpoints. Chained so the routes land in the exported AppType.
 */
export const newsRoutes = new Hono()
	// Public: published articles, newest first.
	.get('/', async c => {
		const rows = await db
			.select()
			.from(news)
			.where(eq(news.published, true))
			.orderBy(desc(news.publishedAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})
	.get('/latest', async c => {
		const [row] = await db
			.select()
			.from(news)
			.where(eq(news.published, true))
			.orderBy(desc(news.publishedAt))
			.limit(1)
		;
		return c.json(await withAuthor(row));
	})

	// Admin: every article including drafts, newest first.
	.get('/admin', requireAdmin, async c => {
		const rows = await db.select().from(news).orderBy(desc(news.createdAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})

	// Admin: a single article by id (draft or published) for the editor.
	.get('/admin/:id', requireAdmin, async c => {
		const id = idParam.parse(c.req.param('id'));
		const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
		if (!row) throw new HTTPException(404, { message: 'Article not found' });
		return c.json(await withAuthor(row));
	})

	// Admin: create.
	.post('/', requireAdmin, jsonBody(newsCreateBody), async c => {
		const body = c.req.valid('json');

		const [dupe] = await db.select({ id: news.id }).from(news).where(eq(news.slug, body.slug)).limit(1);
		if (dupe) throw new HTTPException(409, { message: 'An article with that slug already exists' });

		const [created] = await db.insert(news).values({
			...body,
			authorId: c.get('userId'),
			publishedAt: body.published ? new Date() : null,
		});
		const [row] = await db.select().from(news).where(eq(news.id, created.insertId)).limit(1);
		return c.json(await withAuthor(row!), 201);
	})

	// Admin: update. Toggling `published` on stamps `publishedAt` the first time.
	.patch('/:id', requireAdmin, jsonBody(newsUpdateBody), async c => {
		const id = idParam.parse(c.req.param('id'));
		const body = c.req.valid('json');

		const [existing] = await db.select().from(news).where(eq(news.id, id)).limit(1);
		if (!existing) throw new HTTPException(404, { message: 'Article not found' });

		if (body.slug && body.slug !== existing.slug) {
			const [dupe] = await db.select({ id: news.id }).from(news)
				.where(and(eq(news.slug, body.slug)));
			if (dupe && dupe.id !== id) throw new HTTPException(409, { message: 'An article with that slug already exists' });
		}

		const publishedAt = body.published === undefined
			? existing.publishedAt
			: body.published
				? (existing.publishedAt ?? new Date()) // first publish stamps the date
				: null;

		await db.update(news).set({
			...body, publishedAt, 
		}).where(eq(news.id, id));
		const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	// Admin: delete.
	.delete('/:id', requireAdmin, async c => {
		const id = idParam.parse(c.req.param('id'));
		const [deleted] = await db.delete(news).where(eq(news.id, id));
		if (!deleted.affectedRows) throw new HTTPException(404, { message: 'Article not found' });
		return c.json({ ok: true });
	})

	// Admin: upload a cover image; returns the public path to store as imageUrl.
	.post('/image', requireAdmin, async c => {
		const body = await c.req.parseBody();
		return c.json({ url: await saveUploadedImage(body['file']) });
	})

	// Public: a single published article by slug. Kept last so the static
	// `/admin` paths above aren't shadowed by this `:slug` catch-all.
	.get('/:slug', async c => {
		const slug = c.req.param('slug');
		const [row] = await db
			.select()
			.from(news)
			.where(and(eq(news.slug, slug), eq(news.published, true)))
			.limit(1);
		if (!row) throw new HTTPException(404, { message: 'Article not found' });
		return c.json(await withAuthor(row));
	});
