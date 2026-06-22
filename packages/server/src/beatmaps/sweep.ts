import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { beatmaps } from '../db/schema/beatmap';
import { beatmapset } from '../db/schema/beatmapset';
import { announceRanked } from './announce';

/**
 * Announce scheduled maps whose rank time has passed. Runs on the periodic
 * sweep (see index.ts) so a future-dated map goes live + announces with no
 * redeploy. Safe across the pm2 cluster: the announce is gated on atomically
 * flipping `announced` false->true, so exactly one worker fires the webhook.
 */
export const sweepRankedMaps = async (): Promise<void> => {
	const due = await db
		.select()
		.from(beatmapset)
		.where(and(
			eq(beatmapset.status, 'ranked'),
			eq(beatmapset.announced, false),
			lte(beatmapset.rankedAt, sql`now()`),
		));

	for (const set of due) {
		const [claim] = await db
			.update(beatmapset)
			.set({ announced: true })
			.where(and(eq(beatmapset.id, set.id), eq(beatmapset.announced, false)));
		if (!claim.affectedRows) continue;

		const diffs = await db
			.select({ version: beatmaps.version, sr: beatmaps.sr })
			.from(beatmaps)
			.where(eq(beatmaps.setId, set.id));

		await announceRanked({
			setId: set.id,
			artist: set.artist,
			title: set.title,
			creator: set.creator,
			difficulties: diffs.map(d => ({ version: d.version, sr: Number(d.sr) })),
		});
	}
};
