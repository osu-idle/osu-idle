import {
	bigint,
	decimal,
	double,
	int,
	mysqlTable,
	varchar,
} from 'drizzle-orm/mysql-core';
import { jsonColumn } from '../columns';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import type { CharacterDTO } from '@osu-idle/shared/character';
import type { PendingAction } from '@osu-idle/shared/pendingAction';
import { users } from './user';
import { apiBaseUrl } from '../../env';
import { db } from '../client';
import { eq } from 'drizzle-orm';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';

/** Daily global pp rank samples, oldest first, capped at RANK_HISTORY_DAYS.
 *  `date` is the UTC day (YYYY-MM-DD) of the latest sample. */
export type RankHistory = {
	date: string;
	ranks: number[];
};

export const RANK_HISTORY_DAYS = 90;

const skillColumn = () => int().notNull().default(0);
const overdriveColumn = () => double().notNull().default(0);
// Prestige cycles push a single skill past 1.6e9 and the overall total past
// 1.6e10, well over a signed INT.
const xpColumn = () => bigint({ mode: 'number' }).notNull().default(0);

type SkillColumns =
	& { [K in SkillName as `${K}Level`]: ReturnType<typeof skillColumn> }
	& { [K in SkillName as `${K}Xp`]: ReturnType<typeof xpColumn> }
	& { [K in SkillName as `${K}TotalXp`]: ReturnType<typeof xpColumn> }
	& { [K in SkillName as `${K}LifetimeXp`]: ReturnType<typeof xpColumn> }
	& { [K in SkillName as `${K}Upgrades`]: ReturnType<typeof skillColumn> }
	& { [K in SkillName as `${K}Prestige`]: ReturnType<typeof skillColumn> }
	& { [K in SkillName as `${K}Overdrive`]: ReturnType<typeof overdriveColumn> };

const skillColumns = Object.fromEntries(
	Skills.flatMap(skill => [
		[`${skill}Level`, skillColumn()],
		[`${skill}Xp`, xpColumn()],
		[`${skill}TotalXp`, xpColumn()],
		[`${skill}LifetimeXp`, xpColumn()],
		[`${skill}Upgrades`, skillColumn()],
		[`${skill}Prestige`, skillColumn()],
		[`${skill}Overdrive`, overdriveColumn()],
	]),
) as SkillColumns;

export const characters = mysqlTable('character', {
	id: int().autoincrement().primaryKey(),
	userId: int().notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: varchar({ length: 255 }).unique().notNull(),
	// A player-uploaded avatar overriding the account's osu! one. Stored as a
	// server-relative upload path (e.g. /uploads/x.png); resolved to an absolute
	// URL in characterToDTO, falling back to the osu! avatar.
	avatarUrl: varchar({ length: 512 }),
	...skillColumns,
	overallLevel: skillColumn(),
	overallXp: xpColumn(),
	overallTotalXp: xpColumn(),
	overallLifetimeXp: xpColumn(),
	/** Rebirth number, 1 for a first character. Its unlock set is the first
	 *  generation - 1 entries of the shared list. */
	generation: int().notNull().default(1),
	pp: decimal({
		precision: 10, scale: 3,
	}).notNull().default('0'),
	rankHistory: jsonColumn<RankHistory>(),
	/** The actions a running play has deferred to its end, in order. */
	pendingAction: jsonColumn<PendingAction[]>(),
});

export type CharacterRow = typeof characters.$inferSelect;
export type NewCharacterRow = typeof characters.$inferInsert;

/**
 * The character's profile picture, always a usable absolute URL: its own upload,
 * else the account's osu! avatar, else the guest default.
 */
export const resolveAvatarUrl = (
	characterAvatarUrl: string | null,
	userAvatarUrl?: string | null,
) =>
	characterAvatarUrl ? `${apiBaseUrl}${characterAvatarUrl}` : userAvatarUrl || GUEST_AVATAR_URL;

/** Map a character row to the shared wire contract (skill columns → nested skills). */
export function characterToDTO(
	row: CharacterRow, 
	userAvatarUrl?: string | null, 
	userCountry?: string,
): CharacterDTO {
	const skills = Object.fromEntries(
		Skills.map(s => [s, {
			level: row[`${s}Level`],
			xp: row[`${s}Xp`],
			upgrades: row[`${s}Upgrades`],
			overdrive: row[`${s}Overdrive`],
			prestige: row[`${s}Prestige`],
			lifetimeXp: row[`${s}LifetimeXp`],
		}]),
	) as CharacterDTO['skills'];

	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		avatarUrl: resolveAvatarUrl(row.avatarUrl, userAvatarUrl),
		country: userCountry,
		generation: row.generation,
		overallLevel: row.overallLevel,
		skills,
		pendingActions: row.pendingAction ?? undefined,
	};
}

export const getCharacterById = async (id: number) => {
	const [row] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, id))
		.limit(1);
	return row;
};