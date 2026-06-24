import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import {
	and,
	desc,
	asc,
	eq,
	like,
	or,
} from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { users } from '../db/schema/user';
import { requireAuth } from '../auth/middleware';
import { requireAdmin } from '../auth/admin';
import { saveUploadedImage } from '../uploads';
import {
	skins,
	toSkinDTO,
} from '../db/schema/skin';
import {
	SKIN_STATUS,
	skinCreateBody,
	skinModerateBody,
	skinUpdateBody,
} from '@osu-idle/shared/skin';

const idParam = z.coerce.number().int().positive();

const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => {
		if (!result.success) throw result.error;
	});

const withAuthor = async (row: typeof skins.$inferSelect) => {
	const [author] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, row.authorId))
		.limit(1);
	return toSkinDTO(row, author?.username ?? 'unknown');
};

const ownedBy = async (id: number, userId: number) => {
	const [row] = await db.select().from(skins).where(eq(skins.id, id)).limit(1);
	if (!row) throw new HTTPException(404, { message: 'Add-on not found' });
	if (row.authorId !== userId) throw new HTTPException(403, { message: 'Not your add-on' });
	return row;
};

const csv = (list: string[]) => list.join(',');

export const skinsRoutes = new Hono()
	.get('/', async c => {
		const q = c.req.query('q')?.trim();
		const tag = c.req.query('tag')?.trim().toLowerCase();
		const sort = c.req.query('sort') === 'updated' ? skins.updatedAt : skins.publishedAt;
		const dir = c.req.query('dir') === 'asc' ? asc : desc;

		const where = [eq(skins.status, SKIN_STATUS.PUBLISHED)];
		if (q) where.push(
			or(
				like(skins.name, `%${q}%`), 
				like(users.username, `%${q}%`), 
				like(skins.tags, `%${q}%`),
			)!);
		if (tag) where.push(like(skins.tags, `%${tag}%`));

		const rows = await db
			.select()
			.from(skins)
			.innerJoin(users, eq(users.id, skins.authorId))
			.where(and(...where))
			.orderBy(dir(sort));
		return c.json(rows.map(r => toSkinDTO(r.skin, r.user.username)));
	})

	.get('/me', requireAuth, async c => {
		const rows = await db.select().from(skins)
			.where(eq(skins.authorId, c.get('userId')))
			.orderBy(desc(skins.updatedAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})

	.post('/', requireAuth, jsonBody(skinCreateBody), async c => {
		const body = c.req.valid('json');
		const [created] = await db.insert(skins).values({
			name: body.name,
			description: body.description,
			tags: csv(body.tags),
			version: body.version,
			icon: body.icon,
			definition: body.definition,
			authorId: c.get('userId'),
		});
		const [row] = await db.select().from(skins).where(eq(skins.id, created.insertId)).limit(1);
		return c.json(await withAuthor(row!), 201);
	})

	.post('/icon', requireAuth, async c => {
		const body = await c.req.parseBody();
		return c.json({ url: await saveUploadedImage(body['file']) });
	})

	.get('/admin', requireAdmin, async c => {
		const rows = await db.select().from(skins)
			.where(or(
				eq(skins.status, SKIN_STATUS.PUBLISHED),
			))
			.orderBy(desc(skins.updatedAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})
	
	.patch('/admin/:id', requireAdmin, jsonBody(skinModerateBody), async c => {
		const id = idParam.parse(c.req.param('id'));
		const { status } = c.req.valid('json');
	
		const [existing] = await db.select().from(skins).where(eq(skins.id, id)).limit(1);
		if (!existing) throw new HTTPException(404, { message: 'Skin not found' });
	
		const publishedAt = status === SKIN_STATUS.PUBLISHED
			? (existing.publishedAt ?? new Date())
			: existing.publishedAt;
	
		await db.update(skins).set({
			status, publishedAt,
		}).where(eq(skins.id, id));
		const [row] = await db.select().from(skins).where(eq(skins.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	.post('/:id/submit', requireAuth, async c => {
		const id = idParam.parse(c.req.param('id'));
		const existing = await ownedBy(id, c.get('userId'));
		if (existing.status === SKIN_STATUS.PUBLISHED) {
			throw new HTTPException(409, { message: 'Add-on already submitted' });
		}
		await db.update(skins).set({ status: SKIN_STATUS.PUBLISHED }).where(eq(skins.id, id));
		const [row] = await db.select().from(skins).where(eq(skins.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	.patch('/:id', requireAuth, jsonBody(skinUpdateBody), async c => {
		const id = idParam.parse(c.req.param('id'));
		const body = c.req.valid('json');
		const existing = await ownedBy(id, c.get('userId'));

		await db.update(skins).set({
			...body,
			tags: body.tags ? csv(body.tags) : undefined,
			status: existing.status,
		}).where(eq(skins.id, id));
		const [row] = await db.select().from(skins).where(eq(skins.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	.delete('/:id', requireAuth, async c => {
		const id = idParam.parse(c.req.param('id'));
		await ownedBy(id, c.get('userId'));
		await db.delete(skins).where(eq(skins.id, id));
		return c.json({ ok: true });
	})

	.get('/:id', requireAuth, async c => {
		const id = idParam.parse(c.req.param('id'));
		const [row] = await db.select().from(skins)
			.where(
				and(
					eq(skins.id, id),
					or(
						eq(skins.status, SKIN_STATUS.PUBLISHED),
						eq(skins.authorId, c.get('userId')), 
					),
				),
			)
			.limit(1);
		if (!row) throw new HTTPException(404, { message: 'Skin not found' });
		return c.json(await withAuthor(row));
	});
