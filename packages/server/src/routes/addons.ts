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
import {
	ADDON_STATUS,
	addonCreateBody,
	addonModerateBody,
	addonUpdateBody,
} from '@osu-idle/shared/addon';
import { db } from '../db/client';
import {
	addons,
	toAddonDTO,
} from '../db/schema/addon';
import { users } from '../db/schema/user';
import { requireAuth } from '../auth/middleware';
import { requireAdmin } from '../auth/admin';
import { saveUploadedImage } from '../uploads';

const idParam = z.coerce.number().int().positive();

// Re-throw the ZodError so the app's onError returns the standard shape.
const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => {
		if (!result.success) throw result.error;
	});

/** Join the author's username onto an add-on row and map to the wire shape. */
const withAuthor = async (row: typeof addons.$inferSelect) => {
	const [author] = await db
		.select({ username: users.username })
		.from(users)
		.where(eq(users.id, row.authorId))
		.limit(1);
	return toAddonDTO(row, author?.username ?? 'unknown');
};

/** Load an add-on the caller owns, or throw 404/403. */
const ownedBy = async (id: number, userId: number) => {
	const [row] = await db.select().from(addons).where(eq(addons.id, id)).limit(1);
	if (!row) throw new HTTPException(404, { message: 'Add-on not found' });
	if (row.authorId !== userId) throw new HTTPException(403, { message: 'Not your add-on' });
	return row;
};

const csv = (list: string[]) => list.join(',');

/**
 * Add-ons (user-published mods). Browsing the catalog is public but only exposes
 * published add-ons; authoring is auth-gated and owner-checked; moderation is
 * admin-only. Chained so the routes land in the exported AppType.
 */
export const addonsRoutes = new Hono()
	// Public: browse the published catalog. q matches name/author; tag filters;
	// sort by created or updated date.
	.get('/', async c => {
		const q = c.req.query('q')?.trim();
		const tag = c.req.query('tag')?.trim().toLowerCase();
		const sort = c.req.query('sort') === 'updated' ? addons.updatedAt : addons.publishedAt;
		const dir = c.req.query('dir') === 'asc' ? asc : desc;

		const where = [eq(addons.status, ADDON_STATUS.published)];
		if (q) where.push(
			or(
				like(addons.name, `%${q}%`), 
				like(users.username, `%${q}%`), 
				like(addons.tags, `%${q}%`),
			)!);
		if (tag) where.push(like(addons.tags, `%${tag}%`));

		const rows = await db
			.select()
			.from(addons)
			.innerJoin(users, eq(users.id, addons.authorId))
			.where(and(...where))
			.orderBy(dir(sort));
		return c.json(rows.map(r => toAddonDTO(r.addons, r.user.username)));
	})

	// Auth: the caller's own add-ons (any status, with feedback), newest first.
	.get('/me', requireAuth, async c => {
		const rows = await db.select().from(addons)
			.where(eq(addons.authorId, c.get('userId')))
			.orderBy(desc(addons.updatedAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})

	// Auth: create a draft add-on owned by the caller.
	.post('/', requireAuth, jsonBody(addonCreateBody), async c => {
		const body = c.req.valid('json');
		const [created] = await db.insert(addons).values({
			name: body.name,
			description: body.description,
			tags: csv(body.tags),
			version: body.version,
			gameVersion: body.gameVersion,
			icon: body.icon,
			source: body.source,
			authorId: c.get('userId'),
		});
		const [row] = await db.select().from(addons).where(eq(addons.id, created.insertId)).limit(1);
		return c.json(await withAuthor(row!), 201);
	})

	// Auth: upload an icon image; returns the public path to store as `icon`.
	.post('/icon', requireAuth, async c => {
		const body = await c.req.parseBody();
		return c.json({ url: await saveUploadedImage(body['file']) });
	})

	// Admin: every pending / on-hold / published add-on for the moderation queue.
	.get('/admin', requireAdmin, async c => {
		const rows = await db.select().from(addons)
			.where(or(
				eq(addons.status, ADDON_STATUS.pending),
				eq(addons.status, ADDON_STATUS.onHold),
				eq(addons.status, ADDON_STATUS.published),
			))
			.orderBy(desc(addons.updatedAt));
		return c.json(await Promise.all(rows.map(withAuthor)));
	})

	// Admin: moderate - approve (→ published, stamps publishedAt), deny, unpublish.
	.patch('/admin/:id', requireAdmin, jsonBody(addonModerateBody), async c => {
		const id = idParam.parse(c.req.param('id'));
		const { status, feedback } = c.req.valid('json');

		const [existing] = await db.select().from(addons).where(eq(addons.id, id)).limit(1);
		if (!existing) throw new HTTPException(404, { message: 'Add-on not found' });

		const publishedAt = status === ADDON_STATUS.published
			? (existing.publishedAt ?? new Date())
			: existing.publishedAt;

		// Snapshot the source the admin acted on, so a later re-review can diff
		// against it (what changed since the last validation).
		await db.update(addons).set({
			status, feedback, publishedAt, reviewedSource: existing.source, 
		}).where(eq(addons.id, id));
		const [row] = await db.select().from(addons).where(eq(addons.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	// Auth+owner: edit. Updating an on-hold add-on answers the moderator's
	// feedback, so it re-enters review (pending); changing the source of a
	// published add-on likewise reverts to pending. Other edits keep the status.
	.patch('/:id', requireAuth, jsonBody(addonUpdateBody), async c => {
		const id = idParam.parse(c.req.param('id'));
		const body = c.req.valid('json');
		const existing = await ownedBy(id, c.get('userId'));

		const sourceChanged = body.source !== undefined && body.source !== existing.source;
		const reReview = existing.status === ADDON_STATUS.onHold
			|| (sourceChanged && existing.status === ADDON_STATUS.published);
		const status = reReview ? ADDON_STATUS.pending : existing.status;

		await db.update(addons).set({
			...body,
			tags: body.tags ? csv(body.tags) : undefined,
			status,
		}).where(eq(addons.id, id));
		const [row] = await db.select().from(addons).where(eq(addons.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	// Auth+owner: submit a draft / denied add-on for review.
	.post('/:id/submit', requireAuth, async c => {
		const id = idParam.parse(c.req.param('id'));
		const existing = await ownedBy(id, c.get('userId'));
		if (existing.status === ADDON_STATUS.pending || existing.status === ADDON_STATUS.published) {
			throw new HTTPException(409, { message: 'Add-on already submitted' });
		}
		await db.update(addons).set({
			status: ADDON_STATUS.pending, feedback: null, 
		}).where(eq(addons.id, id));
		const [row] = await db.select().from(addons).where(eq(addons.id, id)).limit(1);
		return c.json(await withAuthor(row!));
	})

	// Auth+owner: delete.
	.delete('/:id', requireAuth, async c => {
		const id = idParam.parse(c.req.param('id'));
		await ownedBy(id, c.get('userId'));
		await db.delete(addons).where(eq(addons.id, id));
		return c.json({ ok: true });
	})

	// Public: a single published add-on (incl source, for install). Kept last so
	// the static paths above aren't shadowed by this `:id` catch-all.
	.get('/:id', async c => {
		const id = idParam.parse(c.req.param('id'));
		const [row] = await db.select().from(addons)
			.where(and(eq(addons.id, id), eq(addons.status, ADDON_STATUS.published)))
			.limit(1);
		if (!row) throw new HTTPException(404, { message: 'Add-on not found' });
		return c.json(await withAuthor(row));
	});
