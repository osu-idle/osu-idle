import {
	int,
	longtext,
	mysqlTable,
	text,
	timestamp,
	unique,
	varchar,
} from 'drizzle-orm/mysql-core';
import {
	ADDON_STATUS,
	type AddonStatus,
} from '@osu-idle/shared/addon';
import { users } from './user';

export const addons = mysqlTable('addons', {
	id: int().autoincrement().primaryKey(),
	authorId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: varchar({ length: 80 }).notNull(),
	description: varchar({ length: 500 }).notNull().default(''),
	tags: varchar({ length: 255 }).notNull().default(''), // comma-separated
	icon: varchar({ length: 512 }), // uploaded image path, null → no icon
	version: varchar({ length: 20 }).notNull().default('0.1.0'),
	gameVersion: varchar({ length: 20 }).notNull(),
	source: longtext().notNull(),
	reviewedSource: longtext(), // source as it was at the last moderation, null → never reviewed
	status: varchar({ length: 20 }).notNull().default(ADDON_STATUS.unpublished),
	feedback: text(), // admin moderation note, null → none
	downloads: int().notNull().default(0), // unique installs, one per player
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
	publishedAt: timestamp(), // null until first published
});

// One row per (add-on, player) - the unique key makes a repeat install a no-op,
// so `addons.downloads` counts distinct players, not raw install clicks.
export const addonDownloads = mysqlTable('addon_downloads', {
	id: int().autoincrement().primaryKey(),
	addonId: int().notNull()
		.references(() => addons.id, { onDelete: 'cascade' }),
	userId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	downloadedAt: timestamp().notNull().defaultNow(),
}, t => [unique().on(t.addonId, t.userId)]);

export type AddonRow = typeof addons.$inferSelect;
export type NewAddonRow = typeof addons.$inferInsert;

const splitTags = (csv: string): string[] => csv ? csv.split(',').filter(Boolean) : [];

/**
 * Map an add-on row (+ resolved author name) to the wire shape. This return type
 * is the single source of the contract - client/web infer it off the route with
 * `InferResponseType`, no parallel DTO declaration.
 */
export const toAddonDTO = (row: AddonRow, authorName: string) => {
	return {
		id: row.id,
		authorId: row.authorId,
		authorName,
		name: row.name,
		description: row.description,
		tags: splitTags(row.tags),
		icon: row.icon ?? null,
		version: row.version,
		gameVersion: row.gameVersion,
		source: row.source,
		reviewedSource: row.reviewedSource ?? null,
		status: row.status as AddonStatus,
		feedback: row.feedback ?? null,
		downloads: row.downloads,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		publishedAt: row.publishedAt?.toISOString() ?? null,
	};
};

export type AddonDTO = ReturnType<typeof toAddonDTO>;
