import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import {
	characters,
	getCharacterById,
	resolveAvatarUrl,
} from '../db/schema/character';
import { getUserById } from '../db/schema/user';
import { getCharacterTotals } from '../db/schema/character_totals';
import {
	bestSkillRank,
	countryRank,
	globalRank,
} from '../rankings';
import {
	getMostPlayed,
	getTotalPlayed,
} from '../db/schema/beatmaps_played';
import { getBestPP } from '../db/schema/best_pp';
import {
	getFirstPlaces,
	getNbFirstPlaces,
} from '../db/schema/first_place';
import { getRecentCharacterScores } from '../db/schema/score';
import { getPlayTime } from '../play';
import {
	fatigueXPFactor,
	getRecoveryTime,
} from '@osu-idle/shared/sim/bots/character';

const numberParam = z.coerce.number().int().positive();

export const charactersRoutes = new Hono()
	.get('/:id', async c => {
		const id = numberParam.parse(c.req.param('id'));

		const [row] = await db.select().from(characters).where(eq(characters.id, id)).limit(1);

		if (!row) throw new HTTPException(404, { message: 'Character not found' });

		const user = await getUserById(row.userId);

		const session = await getPlayTime(id);
		const strainTime = Math.max(0, 
			(session?.currentStrainTime ?? 0) - getRecoveryTime(session?.lastEnd ?? -Infinity, Date.now()),
		);
		const fatigue = fatigueXPFactor(strainTime / 1000);

		return c.json({
			...row,
			avatarUrl: resolveAvatarUrl(row.avatarUrl, user?.avatarUrl),
			fatiguePercent: (1 - fatigue),
			sessionTime: strainTime,
		});
	})

	// Derived profile statistics: aggregates, grade/judgement totals and ranks.
	.get('/:id/stats', async c => {
		const id = numberParam.parse(c.req.param('id'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		const user = await getUserById(character.userId);
		const totals = await getCharacterTotals(character.id);

		const [globalRk, countryRk, scoreRk, overallRk, bestSkill] = await Promise.all([
			globalRank('pp', character.id),
			countryRank('pp', user.country, character.id),
			globalRank('score', character.id),
			globalRank('overall', character.id),
			bestSkillRank(character.id),
		]);

		const stats = {
			pp: Number(character.pp),
			totalHits: totals.hits,
			globalRank: globalRk,
			countryRank: countryRk,
			scoreRank: scoreRk,
			overallRank: overallRk,
			bestSkill,
			...totals,
		};

		return c.json(stats);
	})
	.get('/:id/mostplayed/:page', async c => {
		const id = numberParam.parse(c.req.param('id'));
		const page = numberParam.parse(c.req.param('page'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getMostPlayed(id, page));
	})
	.get('/:id/countplayed', async c => {
		const id = numberParam.parse(c.req.param('id'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getTotalPlayed(id));
	})
	.get('/:id/bestpp/:page', async c => {
		const id = numberParam.parse(c.req.param('id'));
		const page = numberParam.parse(c.req.param('page'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getBestPP(id, page));
	})
	.get('/:id/countfirstplaces', async c => {
		const id = numberParam.parse(c.req.param('id'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getNbFirstPlaces(id));
	})
	.get('/:id/firstplaces/:page', async c => {
		const id = numberParam.parse(c.req.param('id'));
		const page = numberParam.parse(c.req.param('page'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getFirstPlaces(id, page));
	})
	.get('/:id/recent/:page', async c => {
		const id = numberParam.parse(c.req.param('id'));
		const page = numberParam.parse(c.req.param('page'));

		const character = await getCharacterById(id);
		if (!character) throw new HTTPException(404, { message: 'Character not found' });

		return c.json(await getRecentCharacterScores(id, page));
	})
;
