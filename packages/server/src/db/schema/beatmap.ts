import {
	decimal,
	int,
	longtext,
	mysqlTable,
	text,
} from 'drizzle-orm/mysql-core';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const beatmaps = mysqlTable('beatmap', {
	id: int().primaryKey(),
	setId: int().notNull(),
	sr: decimal({
		precision: 10, scale: 3, 
	}).notNull(),
	artist: text().notNull(),
	title: text().notNull(),
	version: text().notNull(),
	keys: int().notNull(),
	// Playable length in milliseconds (matches gameplay HitObject times).
	total_length: int().notNull(),
	chart: longtext().notNull(),
	plays: int().notNull().default(0),
	// Rich per-difficulty metadata for the catalog (previously only in the client
	// manifest). bpm is rounded; objects/rice/ln are note counts; mode is the
	// osu! ruleset (3 = mania). audio/background are the preview asset filenames
	// served under /v1/beatmap/preview/:setId (null when the map has none).
	bpm: int().notNull().default(0),
	objects: int().notNull().default(0),
	rice: int().notNull().default(0),
	ln: int().notNull().default(0),
	mode: int().notNull().default(3),
	audio: text(),
	background: text(),
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