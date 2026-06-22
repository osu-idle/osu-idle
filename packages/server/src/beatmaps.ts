import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { beatmaps } from './db/schema/beatmap';

/**
 * The stored `.osu` chart text for a beatmap, or null when the server hasn't
 * ingested it. A null result means the map is *unranked* - the client falls
 * back to local play (local score, no XP). Populated by `ingest-beatmaps`.
 */
export async function loadChart(beatmapId: number): Promise<string | null> {
	const [row] = await db
		.select({ chart: beatmaps.chart })
		.from(beatmaps)
		.where(eq(beatmaps.id, beatmapId))
		.limit(1);
	return row?.chart ?? null;
}

export async function getBeatmap(beatmapId: number) {
	const [row] = await db
		.select()
		.from(beatmaps)
		.where(eq(beatmaps.id, beatmapId))
		.limit(1);
	return row;
}
