import { int, mysqlTable, text, timestamp } from 'drizzle-orm/mysql-core';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const beatmapset = mysqlTable('beatmapset', {
	id: int().primaryKey(),
	artist: text().notNull(),
	title: text().notNull(),
	creator: text().notNull(),
	rankedAt: timestamp().defaultNow(),
});

export type BeatmapsetRow = typeof beatmapset.$inferSelect;
export type NewBeatmapsetRow = typeof beatmapset.$inferInsert;


export const getBeatmapsetById = async (id: number) => {
	const [row] = await db
		.select()
		.from(beatmapset)
		.where(eq(beatmapset.id, id))
		.limit(1);
	return row;
};