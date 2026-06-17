import { mysqlTable } from 'drizzle-orm/mysql-core';
import { bestConstraints, bestTableDefinition, type ScoreRow } from './score';
import { db } from '../client';
import { eq, and, desc } from 'drizzle-orm';
import { beatmaps } from './beatmap';
import { beatmapset } from './beatmapset';

export const bestPP = mysqlTable('best_pp', bestTableDefinition, bestConstraints);

export type BestPPScoreRow = typeof bestPP.$inferSelect;
export type NewBestPPScoreRow = typeof bestPP.$inferInsert;

export const getBestPPPlay = async (characterId: number, beatmapId: number) => {
	const [row] = await db
		.select()
		.from(bestPP)
		.where(
			and(
				eq(bestPP.characterId, characterId),
				eq(bestPP.beatmapId, beatmapId)
			))
		.limit(1);
	return row;
};

export const setNewBestPPPlay = async (score: ScoreRow) => db
	.insert(bestPP)
	.values(score)
	.onDuplicateKeyUpdate({ set: score });


export const getBestPP = async (characterId: number, page: number = 1) => {
	return db
		.select()
		.from(bestPP)
		.innerJoin(beatmaps, eq(beatmaps.id, bestPP.beatmapId))
		.innerJoin(beatmapset, eq(beatmapset.id, beatmaps.setId))
		.where(eq(bestPP.characterId, characterId))
		.orderBy(desc(bestPP.pp))
		.offset(page === 1 ? 0 : 5 + ((page - 2) * 50))
		.limit(page === 1 ? 5 : 50)
	;
};