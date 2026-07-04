import {
	int,
	mysqlTable,
	timestamp,
	varchar,
} from 'drizzle-orm/mysql-core';
import { eq } from 'drizzle-orm';
import { characters } from './character';
import { db } from '../client';

/** Permanent record of a character's previous names: one row per rename,
 *  holding the name that was replaced. */
export const characterNameHistory = mysqlTable('character_name_history', {
	id: int().autoincrement().primaryKey(),
	characterId: int().notNull()
		.references(() => characters.id, { onDelete: 'cascade' }),
	name: varchar({ length: 255 }).notNull(),
	changedAt: timestamp().notNull().defaultNow(),
});

export type CharacterNameHistoryRow = typeof characterNameHistory.$inferSelect;

/** A character's previous names, oldest first, deduplicated. */
export const getFormerNames = async (characterId: number) => {
	const rows = await db
		.select({ name: characterNameHistory.name })
		.from(characterNameHistory)
		.where(eq(characterNameHistory.characterId, characterId))
		.orderBy(characterNameHistory.id);
	return [...new Set(rows.map(r => r.name))];
};
