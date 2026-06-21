import { and, desc, eq, gte } from 'drizzle-orm';
import cubic_bezier from '@osu-idle/shared/math/cubic_bezier';
import lerp from '@osu-idle/shared/math/lerp';
import { db } from './db/client';
import { scores } from './db/schema/score';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 50;
const PLAYS_FOR_FULL_BLOCK = 25;
const MIN_FACTOR = 0.25;
const BLOCK_CB = cubic_bezier(.6, 0, .6, 1);

export const recentMapPlays = async (characterId: number, beatmapId: number): Promise<number> => {
	const since = new Date(Date.now() - WINDOW_MS);
	const rows = await db
		.select({ beatmapId: scores.beatmapId })
		.from(scores)
		.where(and(eq(scores.characterId, characterId), gte(scores.playedAt, since)))
		.orderBy(desc(scores.playedAt))
		.limit(RECENT_LIMIT);
	return rows.reduce((n, r) => n + (r.beatmapId === beatmapId ? 1 : 0), 0);
};

export const mindblockFactor = (recentPlays: number): number => {
	const t = Math.min(1, recentPlays / PLAYS_FOR_FULL_BLOCK);
	return lerp(1, MIN_FACTOR, BLOCK_CB(t));
};
