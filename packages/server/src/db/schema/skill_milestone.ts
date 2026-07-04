import {
	int,
	mysqlTable,
	primaryKey,
	varchar,
} from 'drizzle-orm/mysql-core';
import { eq } from 'drizzle-orm';
import { characters } from './character';
import { db } from '../client';

/** Highest chat-announced level per (character, skill). Never lowered, so a
 *  character that resets its levels re-climbs without re-announcing. */
export const skillMilestones = mysqlTable('skill_milestone', {
	characterId: int().notNull()
		.references(() => characters.id, { onDelete: 'cascade' }),
	skill: varchar({ length: 32 }).notNull(),
	level: int().notNull(),
}, table => [
	primaryKey({ columns: [table.characterId, table.skill] }),
]);

export type SkillMilestoneRow = typeof skillMilestones.$inferSelect;

export const getSkillMilestones = async (characterId: number) => {
	const rows = await db
		.select()
		.from(skillMilestones)
		.where(eq(skillMilestones.characterId, characterId));
	return new Map(rows.map(r => [r.skill, r.level]));
};

export const setSkillMilestone = async (
	characterId: number,
	skill: string,
	level: number,
) => db
	.insert(skillMilestones)
	.values({
		characterId, skill, level,
	})
	.onDuplicateKeyUpdate({ set: { level } });
