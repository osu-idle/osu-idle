import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
	eq,
	and,
	inArray,
} from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import {
	scores,
	toScoreDTO,
} from '../db/schema/score';
import { best } from '../db/schema/best';
import { characters } from '../db/schema/character';
import { users } from '../db/schema/user';
import { requireAuth } from '../auth/middleware';
import {
	beatmapPageIds,
	beatmapRank,
} from '../rankings';

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

/** Hydrate ranked character ids into their `best` rows on a beatmap, in rank order. */
async function beatmapLeaderboard(beatmapId: number, page: number, country?: string) {
	const ids = await beatmapPageIds(beatmapId, page, country);
	if (ids.length === 0) return [];
	const rows = await db
		.select()
		.from(best)
		.where(and(eq(best.beatmapId, beatmapId), inArray(best.characterId, ids)));
	const byCharacter = new Map(rows.map(r => [r.characterId, r]));
	return ids.map(id => byCharacter.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
}

/** The signed-in character's own best on this beatmap, with its rank (global or
 *  within a country) - shown below the leaderboard even when outside the top 50. */
async function myBeatmapScore(userId: number, beatmapId: number, country?: string) {
	const character = await currentCharacter(userId);
	if (!character) return null;

	const [row] = await db
		.select()
		.from(best)
		.where(and(eq(best.beatmapId, beatmapId), eq(best.characterId, character.id)))
		.limit(1);
	if (!row) return null;

	const rank = await beatmapRank(beatmapId, character.id, country);
	return {
		score: toScoreDTO(row), rank, 
	};
}

export const scoresRoutes = new Hono()
	.get('/:id', async c => {
		const id = idParam.parse(c.req.param('id'));

		const [row] = await db.select().from(scores).where(eq(scores.id, id)).limit(1);

		if (!row) throw new HTTPException(404, { message: 'Score not found' });

		return c.json(row);
	})
	.get('/beatmap/:beatmap', async c => c.json((
		await beatmapLeaderboard(
			idParam.parse(c.req.param('beatmap')),
			1,
		)).map(toScoreDTO)))
	.get('/beatmap/:beatmap/country/:country', async c => c.json((
		await beatmapLeaderboard(
			idParam.parse(c.req.param('beatmap')), 
			1,
			c.req.param('country'),
		)).map(toScoreDTO)))
	.get('/beatmap/:beatmap/me', requireAuth, async c => c.json(
		await myBeatmapScore(
			c.get('userId'),
			idParam.parse(c.req.param('beatmap')),
		)))
	.get('/beatmap/:beatmap/country/:country/me', requireAuth, async c => c.json(
		await myBeatmapScore(
			c.get('userId'), 
			idParam.parse(c.req.param('beatmap')),
			c.req.param('country'),
		)));
