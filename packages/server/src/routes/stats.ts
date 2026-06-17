import { Hono } from 'hono';
import { getOnline, getPlaying } from '../play';
import { db } from '../db/client';
import { scores } from '../db/schema/score';
import { count } from 'drizzle-orm';
import { characters } from '../db/schema/character';
import { getStats } from '../stats';
import { VERSION } from '@osu-idle/shared/version';

export const statsRoutes = new Hono()
	.get('/general', async c => c.json({
		playing: await getPlaying(),
		online: await getOnline(),
		scores: (await db.select({ nb: count() }).from(scores))[0].nb,
		users: (await db.select({ nb: count() }).from(characters))[0].nb,
	}))
	.get('/recent', async c => c.json(await getStats()))
	.get('/version', async c => c.json(VERSION))
;