import { decimal, int, longtext, mysqlTable, text } from 'drizzle-orm/mysql-core';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const beatmaps = mysqlTable('beatmap', {
	id: int().primaryKey(),
	setId: int().notNull(),
	sr: decimal({ precision: 10, scale: 3}).notNull(),
	artist: text().notNull(),
	title: text().notNull(),
	version: text().notNull(),
	keys: int().notNull(),
	total_length: int().notNull(),
	chart: longtext().notNull(),
	plays: int().notNull().default(0),
});

export type BeatmapRow = typeof beatmaps.$inferSelect;
export type NewBeatmapRow = typeof beatmaps.$inferInsert;


export const getBeatmapById = async (id: number) => {
	const [row] = await db
		.select()
		.from(beatmaps)
		.where(eq(beatmaps.id, id))
		.limit(1);
	return row;
};