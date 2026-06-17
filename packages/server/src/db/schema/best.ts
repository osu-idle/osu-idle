import { mysqlTable } from 'drizzle-orm/mysql-core';
import { bestConstraints, bestTableDefinition, type ScoreRow } from './score';
import { db } from '../client';
import { and, eq } from 'drizzle-orm';

export const best = mysqlTable('best', bestTableDefinition, bestConstraints);

export type BestScoreRow = typeof best.$inferSelect;
export type NewBestScoreRow = typeof best.$inferInsert;

export const getBestPlay = async (characterId: number, beatmapId: number) => {
	const [row] = await db
		.select()
		.from(best)
		.where(
			and(
				eq(best.characterId, characterId),
				eq(best.beatmapId, beatmapId)
			))
		.limit(1);
	return row;
};

export const setNewBestPlay = async (score: ScoreRow) => db
	.insert(best)
	.values(score)
	.onDuplicateKeyUpdate({ set: score });