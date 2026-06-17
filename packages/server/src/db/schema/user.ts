import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import type { UserDTO } from '@osu-idle/shared/user';
import { apiBaseUrl } from '../../env';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const users = mysqlTable('user', {
	id: int().primaryKey(), // osu! user ID
	username: varchar({ length: 255 }).notNull(),
	avatarUrl: varchar({ length: 512 }), // osu! avatar; the default profile picture
	// A player-uploaded avatar overriding the osu! one. Stored as a server-relative
	// upload path (e.g. /uploads/x.png); resolved to an absolute URL in toUserDTO.
	customAvatarUrl: varchar({ length: 512 }),
	country: varchar({ length: 2 }).notNull().default('FR'), // osu! country code, e.g. 'FR'
	currentCharacter: int(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export function toUserDTO(row: UserRow): UserDTO {
	return {
		id: row.id,
		username: row.username,
		// A custom upload overrides the osu! avatar; resolve its server-relative
		// path to an absolute URL so every client renders it directly.
		avatarUrl: row.customAvatarUrl ? `${apiBaseUrl}${row.customAvatarUrl}` : row.avatarUrl,
		country: row.country,
		createdAt: row.createdAt.toISOString(),
	};
}

export const getUserById = async (id: number) => {
	const [row] = await db
		.select()
		.from(users)
		.where(eq(users.id, id))
		.limit(1);
	return row;
};