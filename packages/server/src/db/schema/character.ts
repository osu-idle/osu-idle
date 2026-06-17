import { decimal, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { Skills, type SkillName } from '@osu-idle/shared/skills';
import type { CharacterDTO } from '@osu-idle/shared/character';
import { users } from './user';
import { db } from '../client';
import { eq } from 'drizzle-orm';

const skillColumn = () => int().notNull().default(0);

type SkillColumns =
	& { [K in SkillName as `${K}Level`]: ReturnType<typeof skillColumn> }
	& { [K in SkillName as `${K}Xp`]: ReturnType<typeof skillColumn> }
	& { [K in SkillName as `${K}TotalXp`]: ReturnType<typeof skillColumn> };

const skillColumns = Object.fromEntries(
	Skills.flatMap(skill => [
		[`${skill}Level`, skillColumn()],
		[`${skill}Xp`, skillColumn()],
		[`${skill}TotalXp`, skillColumn()],
	]),
) as SkillColumns;

export const characters = mysqlTable('character', {
	id: int().autoincrement().primaryKey(),
	userId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: varchar({ length: 255 }).unique().notNull(),
	...skillColumns,
	overallLevel: skillColumn(),
	overallXp: skillColumn(),
	overallTotalXp: skillColumn(),
	pp: decimal({ precision: 10, scale: 3 }).notNull().default('0'),
});

export type CharacterRow = typeof characters.$inferSelect;
export type NewCharacterRow = typeof characters.$inferInsert;

/** Map a character row to the shared wire contract (skill columns → nested skills). */
export function characterToDTO(row: CharacterRow): CharacterDTO {
	const skills = Object.fromEntries(
		Skills.map(s => [s, { level: row[`${s}Level`], xp: row[`${s}Xp`] }]),
	) as CharacterDTO['skills'];

	return { id: row.id, userId: row.userId, name: row.name, skills };
}

export const getCharacterById = async (id: number) => {
	const [row] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, id))
		.limit(1);
	return row;
};