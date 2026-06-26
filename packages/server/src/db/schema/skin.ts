import {
	int,
	longtext,
	mysqlTable,
	timestamp,
	unique,
	varchar,
} from 'drizzle-orm/mysql-core';
import { users } from './user';
import {
	SKIN_STATUS,
	type SkinStatus,
} from '@osu-idle/shared/skin';

export const skins = mysqlTable('skin', {
	id: int().autoincrement().primaryKey(),
	authorId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: varchar({ length: 80 }).notNull(),
	description: varchar({ length: 500 }).notNull().default(''),
	tags: varchar({ length: 255 }).notNull().default(''),
	icon: varchar({ length: 512 }),
	version: varchar({ length: 20 }).notNull().default('0.1.0'),
	definition: longtext().notNull(),
	status: varchar({ length: 20 }).notNull().default(SKIN_STATUS.UNPUBLISHED),
	downloads: int().notNull().default(0), // unique installs, one per player
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
	publishedAt: timestamp(),
});

// One row per (skin, player); the unique key dedupes repeat installs so
// `skins.downloads` counts distinct players.
export const skinDownloads = mysqlTable('skin_downloads', {
	id: int().autoincrement().primaryKey(),
	skinId: int().notNull()
		.references(() => skins.id, { onDelete: 'cascade' }),
	userId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	downloadedAt: timestamp().notNull().defaultNow(),
}, t => [unique().on(t.skinId, t.userId)]);

export type SkinRow = typeof skins.$inferSelect;
export type NewSkinRow = typeof skins.$inferInsert;

const splitTags = (csv: string): string[] => csv ? csv.split(',').filter(Boolean) : [];

export const toSkinDTO = (row: SkinRow, authorName: string) => {
	return {
		id: row.id,
		authorId: row.authorId,
		authorName,
		name: row.name,
		description: row.description,
		tags: splitTags(row.tags),
		icon: row.icon,
		version: row.version,
		definition: row.definition,
		status: row.status as SkinStatus,
		downloads: row.downloads,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
		publishedAt: row.publishedAt?.toISOString() ?? null,
	};
};

export type SkinDTO = ReturnType<typeof toSkinDTO>;
