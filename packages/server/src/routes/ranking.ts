import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { characters } from '../db/schema/character';
import { character_totals } from '../db/schema/character_totals';
import { desc, eq } from 'drizzle-orm';
import { users } from '../db/schema/user';
import type { SkillName } from '@osu-idle/shared/skills';

const idParam = z.coerce.number().int().positive();

const getRanking = (page: number) => {
	return db
		.select()
		.from(characters)
		.innerJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.orderBy(desc(characters.pp), desc(character_totals.rankedScore))
		.limit(50)
		.offset((page - 1) * 50);
};

const getScoreRanking = (page: number) => {
	return db
		.select()
		.from(characters)
		.innerJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.orderBy(desc(character_totals.rankedScore), desc(characters.pp))
		.limit(50)
		.offset((page - 1) * 50);
};

const isValidSkill = (str: string): str is ('overall' | SkillName) => `${str}Level` in characters;
const getSkillRanking = (skill: string, page: number, country?: string) => {
	if (!isValidSkill(skill)) throw new Error('Invalid parameters');
	return db
		.select()
		.from(characters)
		.innerJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.where(country === undefined ? undefined : eq(users.country, country))
		.orderBy(desc(characters[`${skill}Level`]), desc(characters[`${skill}Xp`]), desc(characters.pp))
		.limit(50)
		.offset((page - 1) * 50);
};

export const rankingRoutes = new Hono()
	.get('/global/:page', async c => c.json(await getRanking(idParam.parse(c.req.param('page')))))
	.get('/score/:page', async c => c.json(await getScoreRanking(idParam.parse(c.req.param('page')))))
	.get('/skill/:skill/page/:page', async c => c.json(await getSkillRanking(c.req.param('skill'), idParam.parse(c.req.param('page')))))
	.get('/skill/:skill/country/:country/page/:page', async c => c.json(await getSkillRanking(c.req.param('skill'), idParam.parse(c.req.param('page')), c.req.param('country'))))
;
