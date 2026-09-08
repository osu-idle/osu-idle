import { Hono } from 'hono';
import { z } from 'zod';
import type { SkillName } from '@osu-idle/shared/skills';
import { characters } from '../db/schema/character';
import {
	gradesPage,
	playerCountries,
	ppPage,
	scorePage,
	skillPage,
} from '../rankings';
import {
	GOOD_GRADE,
	type GoodGrade,
} from '@osu-idle/shared/judgement';

const idParam = z.coerce.number().int().positive();

const isValidSkill = (str: string): str is ('overall' | SkillName) => `${str}Level` in characters;

const skillRanking = (skill: string, page: number, country?: string) => {
	if (!isValidSkill(skill)) throw new Error('Invalid parameters');
	return skillPage(skill, page, country);
};

const isValidGrade = (str: string): str is ('all' | GoodGrade) => 
	str === 'all' || str in GOOD_GRADE;

const gradesRanking = (grade: string, page: number, country?: string) => {
	if (!isValidGrade(grade)) throw new Error('Invalid parameters');
	return gradesPage(grade, page, country);
};

/** The same skills, ranked on what they have ever earned rather than what they
 *  hold: `overall` is the summed column. */
const lifetimeRanking = (skill: string, page: number, country?: string) => {
	if (!isValidSkill(skill)) throw new Error('Invalid parameters');
	return skillPage(`lifetime:${skill}`, page, country);
};

/** How many times each skill has been prestiged; `overall` is the total. */
const prestigeRanking = (skill: string, page: number, country?: string) => {
	if (!isValidSkill(skill)) throw new Error('Invalid parameters');
	return skillPage(skill === 'overall' ? 'prestige:total' : `prestige:${skill}`, page, country);
};

export const rankingRoutes = new Hono()
	.get('/countries', async c => c.json(
		await playerCountries(),
	))
	.get('/global/:page', async c => c.json(await ppPage(
		idParam.parse(c.req.param('page')),
	)))
	.get('/global/country/:country/:page', async c => c.json(
		await ppPage(
			idParam.parse(c.req.param('page')), 
			c.req.param('country')),
	))
	.get('/score/:page', async c => c.json(await scorePage(idParam.parse(c.req.param('page')))))
	.get('/score/country/:country/:page', async c => c.json(
		await scorePage(
			idParam.parse(c.req.param('page')), 
			c.req.param('country')),
	))
	.get('/skill/:skill/page/:page', async c => c.json(
		await skillRanking(
			c.req.param('skill'), 
			idParam.parse(c.req.param('page')),
		)))
	.get('/skill/:skill/country/:country/page/:page', async c => c.json(
		await skillRanking(
			c.req.param('skill'), 
			idParam.parse(c.req.param('page')), 
			c.req.param('country'),
		),
	))
	.get('/lifetime/:skill/page/:page', async c => c.json(
		await lifetimeRanking(
			c.req.param('skill'),
			idParam.parse(c.req.param('page')),
		)))
	.get('/lifetime/:skill/country/:country/page/:page', async c => c.json(
		await lifetimeRanking(
			c.req.param('skill'),
			idParam.parse(c.req.param('page')),
			c.req.param('country'),
		)))
	.get('/prestige/:skill/page/:page', async c => c.json(
		await prestigeRanking(
			c.req.param('skill'),
			idParam.parse(c.req.param('page')),
		)))
	.get('/prestige/:skill/country/:country/page/:page', async c => c.json(
		await prestigeRanking(
			c.req.param('skill'),
			idParam.parse(c.req.param('page')),
			c.req.param('country'),
		)))
	.get('/grades/:grade/page/:page', async c => c.json(
		await gradesRanking(
			c.req.param('grade'), 
			idParam.parse(c.req.param('page')),
		)))
	.get('/grades/:grade/country/:country/page/:page', async c => c.json(
		await gradesRanking(
			c.req.param('grade'), 
			idParam.parse(c.req.param('page')), 
			c.req.param('country'),
		),
	))
;
