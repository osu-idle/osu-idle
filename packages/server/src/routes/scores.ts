import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, desc, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { scores, toScoreDTO } from '../db/schema/score';
import { best } from '../db/schema/best';

const idParam = z.coerce.number().int().positive();

export const scoresRoutes = new Hono()
	.get('/:id', async c => {
		const id = idParam.parse(c.req.param('id'));

		const [row] = await db.select().from(scores).where(eq(scores.id, id)).limit(1);

		if (!row) throw new HTTPException(404, { message: 'Score not found' });

		return c.json(row);
	})
	.get('/beatmap/:beatmap', async c => {
		const id = idParam.parse(c.req.param('beatmap'));

		const rows = await db
			.select()
			.from(best)
			.where(eq(best.beatmapId, id))
			.orderBy(desc(best.score), asc(best.id))
			.limit(50);

		return c.json(rows.map(toScoreDTO));
	});
