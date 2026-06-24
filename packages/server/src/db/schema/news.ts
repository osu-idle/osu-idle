import {
	boolean,
	int,
	mysqlTable,
	text,
	timestamp,
	varchar,
} from 'drizzle-orm/mysql-core';
import type {
	NewsDTO,
	NewsTag,
} from '@osu-idle/shared/news';
import { users } from './user';

export const news = mysqlTable('news', {
	id: int().autoincrement().primaryKey(),
	slug: varchar({ length: 120 }).notNull().unique(),
	title: varchar({ length: 200 }).notNull(),
	summary: varchar({ length: 500 }).notNull(),
	content: text().notNull(),
	tag: varchar({ length: 32 }).notNull().default('update'),
	imageUrl: varchar({ length: 512 }), // custom cover, null → tag default
	authorId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	published: boolean().notNull().default(false),
	publishedAt: timestamp(), // null while a draft
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
});

export type NewsRow = typeof news.$inferSelect;
export type NewNewsRow = typeof news.$inferInsert;

/** Map a news row (+ resolved author name) to the shared wire contract. */
export function toNewsDTO(row: NewsRow, authorName: string): NewsDTO {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		summary: row.summary,
		content: row.content,
		tag: row.tag as NewsTag,
		imageUrl: row.imageUrl ?? null,
		authorId: row.authorId,
		authorName,
		published: row.published,
		publishedAt: row.publishedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}
