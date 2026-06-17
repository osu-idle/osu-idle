import { int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { characters } from './character';
import { db } from '../client';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { beatmaps } from './beatmap';
import { beatmapset } from './beatmapset';


export const beatmaps_played = mysqlTable('beatmaps_played', {
	characterId: int().notNull()
		.references(() => characters.id, { onDelete: 'cascade' }),
	beatmapId: int().notNull()
		.references(() => beatmaps.id, { onDelete: 'cascade' }),
	plays: int().notNull().default(0),
	memory: int().notNull().default(0),
}, table => [
	primaryKey({ columns: [table.characterId, table.beatmapId]})
]);

export type BeatmapsPlayedRow = typeof beatmaps_played.$inferSelect;
export type NewBeatmapsPlayedRow = typeof beatmaps_played.$inferInsert;


export const getMostPlayed = async (characterId: number, page: number = 1) => {
	return db
		.select()
		.from(beatmaps_played)
		.innerJoin(beatmaps, eq(beatmaps.id, beatmaps_played.beatmapId))
		.innerJoin(beatmapset, eq(beatmapset.id, beatmaps.setId))
		.where(eq(beatmaps_played.characterId, characterId))
		.orderBy(desc(beatmaps_played.plays))
		.offset(page === 1 ? 0 : 5 + ((page - 2) * 50))
		.limit(page === 1 ? 5 : 50)
	;
};

export const getTotalPlayed = async (characterId: number) => {
	return (await db
		.select({
			characterId: beatmaps_played.characterId,
			maps: count(),
		})
		.from(beatmaps_played)
		.where(eq(beatmaps_played.characterId, characterId))
		.groupBy(beatmaps_played.characterId))[0]?.maps ?? 0;
};

/** How many times this character has already played this map (0 if never).
 *  Read before a play to drive the memory skill. */
export const getPlays = async (characterId: number, beatmapId: number): Promise<number> => {
	const row = (await db
		.select({ plays: beatmaps_played.memory })
		.from(beatmaps_played)
		.where(and(eq(beatmaps_played.characterId, characterId), eq(beatmaps_played.beatmapId, beatmapId))))[0];
	return row?.plays ?? 0;
};

export const addBeatmapPlayed = async (characterId: number, beatmapId: number) => {
	await db.update(beatmaps)
		.set({
			plays: sql`${beatmaps.plays} + 1`,
		})
		.where(eq(beatmaps.id, beatmapId));

	return db
		.insert(beatmaps_played)
		.values({
			characterId,
			beatmapId,
			plays: 1,
			memory: 1,
		})
		.onDuplicateKeyUpdate({
			set: {
				plays: sql`${beatmaps_played.plays} + 1`,
				memory: sql`${beatmaps_played.memory} + 1`,
			}
		})
	;
};