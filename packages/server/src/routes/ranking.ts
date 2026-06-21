import { Hono } from 'hono';
import { z } from 'zod';
import type { SkillName } from '@osu-idle/shared/skills';
import { characters } from '../db/schema/character';
import { playerCountries, ppPage, scorePage, skillPage } from '../rankings';

const idParam = z.coerce.number().int().positive();

const isValidSkill = (str: string): str is ('overall' | SkillName) => `${str}Level` in characters;

const skillRanking = (skill: string, page: number, country?: string) => {
	if (!isValidSkill(skill)) throw new Error('Invalid parameters');
	return skillPage(skill, page, country);
};

export const rankingRoutes = new Hono()
	.get('/countries', async c => c.json(await playerCountries()))
	.get('/global/:page', async c => c.json(await ppPage(idParam.parse(c.req.param('page')))))
	.get('/global/country/:country/:page', async c => c.json(await ppPage(idParam.parse(c.req.param('page')), c.req.param('country'))))
	.get('/score/:page', async c => c.json(await scorePage(idParam.parse(c.req.param('page')))))
	.get('/score/country/:country/:page', async c => c.json(await scorePage(idParam.parse(c.req.param('page')), c.req.param('country'))))
	.get('/skill/:skill/page/:page', async c => c.json(await skillRanking(c.req.param('skill'), idParam.parse(c.req.param('page')))))
	.get('/skill/:skill/country/:country/page/:page', async c => c.json(await skillRanking(c.req.param('skill'), idParam.parse(c.req.param('page')), c.req.param('country'))))
;
