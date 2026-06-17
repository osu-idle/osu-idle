import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { asc, desc, eq, getTableColumns, sum } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { beatmaps } from '../db/schema/beatmap';
import { beatmapset } from '../db/schema/beatmapset';

const idParam = z.coerce.number().int().positive();

export const beatmapsRoutes = new Hono()
	.get('/all/:dir', async c => {
		const sort = c.req.param('dir') === 'asc' ? asc : desc;
		return c.json(await db
			.select({
				...getTableColumns(beatmapset),
				plays: sum(beatmaps.plays)
			})
			.from(beatmapset)
			.innerJoin(beatmaps, eq(beatmapset.id, beatmaps.setId))
			.groupBy(beatmapset.id)
			.orderBy(sort(beatmapset.rankedAt))
		);
	})
	.get('/recent', async c => {
		return c.json(await db
			.select()
			.from(beatmapset)
			.orderBy(desc(beatmapset.rankedAt))
			.limit(10)
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
			.groupBy(beatmapset.id)
			.orderBy(sort(plays))
		);
	})
	.get('/:id', async c => {
		const id = idParam.parse(c.req.param('id'));

		const [row] = await db.select().from(beatmaps).where(eq(beatmaps.id, id)).limit(1);

		if (!row) throw new HTTPException(404, { message: 'Score not found' });

		return c.json(row);
	})
;
