import {
	mysqlTable,
	primaryKey,
} from 'drizzle-orm/mysql-core';
import {
	bestTableDefinition,
	type ScoreRow,
} from './score';
import { db } from '../client';
import {
	eq,
	desc,
	count,
} from 'drizzle-orm';
import { beatmaps } from './beatmap';
import { beatmapset } from './beatmapset';

export const firstPlace = mysqlTable('first_place', bestTableDefinition, table => [
	primaryKey({ columns: [table.beatmapId] }),
]);

export type FirstPlaceRow = typeof firstPlace.$inferSelect;
export type NewFirstPlaceRow = typeof firstPlace.$inferInsert;

export const setNewFirstPlace = async (score: ScoreRow) => db
	.insert(firstPlace)
	.values(score)
	.onDuplicateKeyUpdate({ set: score });

export const getNbFirstPlaces = async (characterId: number) => (await db
	.select({ count: count() })
	.from(firstPlace)
	.where(eq(firstPlace.characterId, characterId))
	.limit(1))[0]?.count ?? 0
;

export const getFirstPlaces = async (characterId: number, page: number = 1) => {
	return db
		.select()
		.from(firstPlace)
		.innerJoin(beatmaps, eq(beatmaps.id, firstPlace.beatmapId))
		.innerJoin(beatmapset, eq(beatmapset.id, beatmaps.setId))
		.where(eq(firstPlace.characterId, characterId))
		.orderBy(desc(firstPlace.playedAt))
		.offset(page === 1 ? 0 : 5 + ((page - 2) * 50))
		.limit(page === 1 ? 5 : 50)
	;
};

export const getFirstPlace = async (beatmapId: number) => {
	return (await db
		.select()
		.from(firstPlace)
		.where(eq(firstPlace.beatmapId, beatmapId)))[0];
	;
};