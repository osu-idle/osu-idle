import { boolean, int, mysqlEnum, mysqlTable, text, timestamp } from 'drizzle-orm/mysql-core';
import { BEATMAP_STATUS } from '@osu-idle/shared/beatmap';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const beatmapset = mysqlTable('beatmapset', {
	id: int().primaryKey(),
	artist: text().notNull(),
	title: text().notNull(),
	creator: text().notNull(),
	// 'pending' = uploaded, not scheduled; 'ranked' = scheduled/live (live once
	// rankedAt has passed); 'rejected' = pulled from the nomination queue.
	status: mysqlEnum(BEATMAP_STATUS).notNull().default('pending'),
	// The scheduled rank time. Null until scheduled; a set is live (downloadable,
	// listed) only when status='ranked' AND rankedAt <= now().
	rankedAt: timestamp(),
	// Set true by the rank sweep once the "now ranked" webhook has fired, so it
	// announces each map exactly once when its rankedAt passes.
	announced: boolean().notNull().default(false),
	// When the set entered the queue (uploaded / submitted). Drives the
	// nomination list's sort.
	submittedAt: timestamp().notNull().defaultNow(),
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