import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import {
	and,
	asc,
	desc,
	eq,
	getTableColumns,
	ne,
	sum,
} from 'drizzle-orm';
import { z } from 'zod';
import {
	BEATMAP_STATUS,
	INTRO_SET_ID,
} from '@osu-idle/shared/beatmap';
import { existsSync } from 'node:fs';
import {
	readFile,
	readdir,
	rm,
} from 'node:fs/promises';
import { db } from '../db/client';
import { beatmaps } from '../db/schema/beatmap';
import {
	beatmapset,
	getBeatmapsetById,
} from '../db/schema/beatmapset';
import { requireAdmin } from '../auth/admin';
import { ingestOsz } from '../beatmaps/ingest';
import { purgeBeatmapScores } from '../scores';
import {
	buildCatalog,
	isSetLive,
	liveDiffCondition,
} from '../beatmaps/catalog';
import {
	PREVIEW_DIR,
	oszPath,
	previewPath,
} from '../beatmaps/storage';

const idParam = z.coerce.number().int().positive();

// Public listings show live sets (ranked diffs only) but never the intro (it's
// not a ranked map). Every listing joins `beatmaps`, so the diff gate applies.
const listedCondition = and(liveDiffCondition, ne(beatmapset.id, INTRO_SET_ID));

const PREVIEW_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
};

// Re-throw zValidator failures so the app's onError returns our standard 400.
const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => { if (!result.success) throw result.error; });

const nominationPatch = z.object({
	rankedAt: z.string().datetime().nullable().optional(),
	status: z.enum(BEATMAP_STATUS).optional(),
});

export const beatmapsRoutes = new Hono()
	// Public, live-only (status='ranked' AND rankedAt <= now()).
	.get('/catalog', async c => c.json(await buildCatalog()))

	.get('/all/:dir', async c => {
		const sort = c.req.param('dir') === 'asc' ? asc : desc;
		return c.json(await db
			.select({
				...getTableColumns(beatmapset),
				plays: sum(beatmaps.plays),
			})
			.from(beatmapset)
			.innerJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
			.where(listedCondition)
			.groupBy(beatmapset.id)
			.orderBy(sort(beatmapset.rankedAt)),
		);
	})
	.get('/recent', async c => {
		return c.json(await db
			.select(getTableColumns(beatmapset))
			.from(beatmapset)
			.innerJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
			.where(listedCondition)
			.groupBy(beatmapset.id)
			.orderBy(desc(beatmapset.rankedAt))
			.limit(10),
		);
	})
	.get('/popular/:dir', async c => {
		const sort = c.req.param('dir') === 'asc' ? asc : desc;
		const plays = sum(beatmaps.plays).as('plays');
		return c.json(await db
			.select({
				...getTableColumns(beatmapset),
				plays,
			})
			.from(beatmapset)
			.innerJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
			.where(listedCondition)
			.groupBy(beatmapset.id)
			.orderBy(sort(plays)),
		);
	})

	// Stream a live set's .osz (404 until it's ranked + due). Returns a raw
	// Response: the client fetches this URL directly, not via the typed RPC.
	.get('/osz/:setId', async c => {
		const id = idParam.parse(c.req.param('setId'));
		if (!await isSetLive(id)) throw new HTTPException(404, { message: 'Beatmap not available' });

		const path = oszPath(id);
		if (!existsSync(path)) throw new HTTPException(404, { message: 'Beatmap file missing' });

		const buf = await readFile(path);
		return new Response(buf, {
			headers: {
				'Content-Type': 'application/octet-stream',
				'Content-Length': String(buf.length),
				'Content-Disposition': `attachment; filename="${id}.osz"`,
			},
		});
	})

	// Stream a live set's preview audio/background. File names are set-id prefixed.
	.get('/preview/:setId/:file', async c => {
		const id = idParam.parse(c.req.param('setId'));
		const file = c.req.param('file');
		if (file.includes('/') || file.includes('..') || !file.startsWith(String(id))) {
			throw new HTTPException(400, { message: 'Bad preview path' });
		}
		if (!await isSetLive(id)) throw new HTTPException(404, { message: 'Beatmap not available' });

		const path = previewPath(file);
		if (!existsSync(path)) throw new HTTPException(404, { message: 'Preview missing' });

		const ext = file.split('.').pop()?.toLowerCase() ?? '';
		const buf = await readFile(path);
		return new Response(buf, {
			headers: {
				'Content-Type': PREVIEW_MIME[ext] ?? 'application/octet-stream',
				'Content-Length': String(buf.length),
			},
		});
	})

	// --- Beatmap nomination (admin): manage the queue + ranked dates. ---
	.get('/nomination', requireAdmin, async c => {
		const sets = await db
			.select({
				...getTableColumns(beatmapset),
				plays: sum(beatmaps.plays),
			})
			.from(beatmapset)
			.leftJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
			.groupBy(beatmapset.id)
			.orderBy(desc(beatmapset.id));

		const diffs = await db
			.select({
				id: beatmaps.id,
				setId: beatmaps.setId,
				version: beatmaps.version,
				sr: beatmaps.sr,
				keys: beatmaps.keys,
				plays: beatmaps.plays,
				ranked: beatmaps.ranked,
			})
			.from(beatmaps);

		const bySet = new Map<number, typeof diffs>();
		for (const diff of diffs) {
			const list = bySet.get(diff.setId);
			if (list) list.push(diff);
			else bySet.set(diff.setId, [diff]);
		}

		return c.json(sets.map(set => ({
			...set,
			diffs: (bySet.get(set.id) ?? []).sort((a, b) => Number(a.sr) - Number(b.sr)),
		})));
	})
	.post('/nomination', requireAdmin, async c => {
		const body = await c.req.parseBody();
		const file = body['file'];
		if (!(file instanceof File)) throw new HTTPException(400, { message: 'No .osz file provided' });

		const buffer = Buffer.from(await file.arrayBuffer());
		try {
			return c.json(await ingestOsz(buffer));
		} catch (e) {
			throw new HTTPException(400, { message: e instanceof Error ? e.message : 'Could not ingest beatmap' });
		}
	})
	.patch('/nomination/:setId', requireAdmin, jsonBody(nominationPatch), async c => {
		const id = idParam.parse(c.req.param('setId'));
		const body = c.req.valid('json');

		const existing = await getBeatmapsetById(id);
		if (!existing) throw new HTTPException(404, { message: 'Beatmap set not found' });

		const updates: Partial<typeof beatmapset.$inferInsert> = {};
		if (body.rankedAt !== undefined) updates.rankedAt = body.rankedAt ? new Date(body.rankedAt) : null;
		if (body.status !== undefined) {
			updates.status = body.status;
			// Re-arm the announce when (re)ranking, so the sweep posts it once due.
			if (body.status === 'ranked') updates.announced = false;
		}

		await db.update(beatmapset).set(updates).where(eq(beatmapset.id, id));

		// Unranking the set wipes all progression earned on its difficulties.
		if (existing.status === 'ranked' && body.status !== undefined && body.status !== 'ranked') {
			const diffs = await db
				.select({ id: beatmaps.id })
				.from(beatmaps)
				.where(eq(beatmaps.setId, id));
			for (const diff of diffs) await purgeBeatmapScores(diff.id);
		}

		return c.json({ ok: true });
	})
	// Toggle one difficulty in/out of the ranked set. Works before the set is
	// live (choose which diffs go ranked) and after (unrank a single diff).
	.patch('/nomination/:setId/beatmap/:beatmapId', requireAdmin,
		jsonBody(z.object({ ranked: z.boolean() })), async c => {
			const setId = idParam.parse(c.req.param('setId'));
			const beatmapId = idParam.parse(c.req.param('beatmapId'));
			const { ranked } = c.req.valid('json');

			// Only 4K is playable; non-4K diffs can never be ranked (intro exempt).
			if (ranked && setId !== INTRO_SET_ID) {
				const [diff] = await db
					.select({ keys: beatmaps.keys })
					.from(beatmaps)
					.where(and(eq(beatmaps.id, beatmapId), eq(beatmaps.setId, setId)))
					.limit(1);
				if (!diff) throw new HTTPException(404, { message: 'Beatmap not found' });
				if (diff.keys !== 4) {
					throw new HTTPException(400, { message: 'Only 4K difficulties can be ranked' });
				}
			}

			const [res] = await db
				.update(beatmaps)
				.set({ ranked })
				.where(and(eq(beatmaps.id, beatmapId), eq(beatmaps.setId, setId)));
			if (!res.affectedRows) throw new HTTPException(404, { message: 'Beatmap not found' });

			// Unranking a difficulty wipes all progression earned on it.
			if (!ranked) await purgeBeatmapScores(beatmapId);
			return c.json({ ok: true });
		})
	.delete('/nomination/:setId', requireAdmin, async c => {
		const id = idParam.parse(c.req.param('setId'));

		// Scores have no FK on beatmapId: purge progression before the rows go.
		const diffs = await db
			.select({ id: beatmaps.id })
			.from(beatmaps)
			.where(eq(beatmaps.setId, id));
		for (const diff of diffs) await purgeBeatmapScores(diff.id);

		await db.delete(beatmaps).where(eq(beatmaps.setId, id));
		const [res] = await db.delete(beatmapset).where(eq(beatmapset.id, id));

		await rm(oszPath(id), { force: true });
		const previews = await readdir(PREVIEW_DIR).catch(() => [] as string[]);
		await Promise.all(previews
			.filter(f => f.startsWith(`${id}.`) || f.startsWith(`${id}-`))
			.map(f => rm(previewPath(f), { force: true })),
		);

		if (!res.affectedRows) throw new HTTPException(404, { message: 'Beatmap set not found' });
		return c.json({ ok: true });
	})

	// Single beatmap (difficulty), live-only. Keep last: catch-all `:id`.
	.get('/:id', async c => {
		const id = idParam.parse(c.req.param('id'));

		const [row] = await db
			.select(getTableColumns(beatmaps))
			.from(beatmaps)
			.innerJoin(beatmapset, eq(beatmaps.setId, beatmapset.id))
			.where(and(eq(beatmaps.id, id), liveDiffCondition))
			.limit(1);

		if (!row) throw new HTTPException(404, { message: 'Beatmap not found' });

		return c.json(row);
	})
;
