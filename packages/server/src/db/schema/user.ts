import { int, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import type { UserDTO } from '@osu-idle/shared/user';
import { db } from '../client';
import { eq } from 'drizzle-orm';

export const users = mysqlTable('user', {
	id: int().primaryKey(), // osu! user ID
	username: varchar({ length: 255 }).notNull(),
	avatarUrl: varchar({ length: 512 }), // osu! avatar; the default profile picture
	country: varchar({ length: 2 }).notNull().default('FR'), // osu! country code, e.g. 'FR'
	currentCharacter: int(),
	createdAt: timestamp().notNull().defaultNow(),
	updatedAt: timestamp().notNull().defaultNow().onUpdateNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/** Map a user row to the wire contract. `avatarUrl` is the account's osu! avatar;
 *  a per-character custom upload lives on the character and overrides it there. */
export function toUserDTO(row: UserRow): UserDTO {
	return {
		id: row.id,
		username: row.username,
		avatarUrl: row.avatarUrl,
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