import {
	int,
	mysqlEnum,
	mysqlTable,
	primaryKey,
	text,
	timestamp,
} from 'drizzle-orm/mysql-core';
import { BEATMAP_REQUEST_STATUS } from '@osu-idle/shared/beatmapRequest';

/**
 * A player's ranking proposition - the public front of the nomination queue.
 * Keyed by the osu! beatmapset id, so one map is one row and everyone else backs
 * it through `beatmap_request_vote` instead of filing a duplicate. Metadata is
 * copied in at submit time (from the stats mirror or the osu! API) so the queue
 * renders without a lookup per row. `accepted` is stamped by the ingest itself.
 */
export const beatmapRequests = mysqlTable('beatmap_request', {
	setId: int().primaryKey(),
	userId: int().notNull(),
	artist: text().notNull(),
	title: text().notNull(),
	creator: text().notNull(),
	status: mysqlEnum(BEATMAP_REQUEST_STATUS).notNull().default('pending'),
	// Admin's reason, shown next to a rejected request.
	note: text(),
	createdAt: timestamp().notNull().defaultNow(),
	resolvedAt: timestamp(),
	resolvedBy: int(),
});

export type BeatmapRequestRow = typeof beatmapRequests.$inferSelect;

export const beatmapRequestVotes = mysqlTable('beatmap_request_vote', {
	setId: int().notNull(),
	userId: int().notNull(),
	createdAt: timestamp().notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.setId, table.userId] })]);
