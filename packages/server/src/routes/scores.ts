import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, desc, asc, and, or, gt, lt, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { scores, toScoreDTO } from '../db/schema/score';
import { best } from '../db/schema/best';
import { characters } from '../db/schema/character';
import { users } from '../db/schema/user';
import { requireAuth } from '../auth/middleware';

const idParam = z.coerce.number().int().positive();

/** The signed-in user's active character row, or undefined if not onboarded. */
async function currentCharacter(userId: number) {
	const [row] = await db
		.select()
		.from(characters)
		.innerJoin(users, eq(users.currentCharacter, characters.id))
		.where(eq(users.id, userId))
		.limit(1);
	return row?.character;
}

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
	})
	// The signed-in character's own best on this beatmap, with its global rank -
	// shown below the leaderboard even when it's outside the top 50.
	.get('/beatmap/:beatmap/me', requireAuth, async c => {
		const id = idParam.parse(c.req.param('beatmap'));

		const character = await currentCharacter(c.get('userId'));
		if (!character) return c.json(null);

		const [row] = await db
			.select()
			.from(best)
			.where(and(eq(best.beatmapId, id), eq(best.characterId, character.id)))
			.limit(1);
		if (!row) return c.json(null);

		// Rank = how many bests sort above this one, matching the leaderboard order
		// (score desc, id asc), plus one.
		const [{ above }] = await db
			.select({ above: count() })
			.from(best)
			.where(and(
				eq(best.beatmapId, id),
				or(
					gt(best.score, row.score),
					and(eq(best.score, row.score), lt(best.id, row.id)),
				),
			));

		return c.json({ score: toScoreDTO(row), rank: above + 1 });
	});
