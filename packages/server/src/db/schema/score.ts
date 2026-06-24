import {
	Grades,
	type Judgement,
	Judgements,
} from '@osu-idle/shared/judgement';
import {
	type AnyMySqlColumn,
	boolean,
	decimal,
	index,
	int,
	mysqlEnum,
	mysqlTable,
	primaryKey,
	timestamp,
} from 'drizzle-orm/mysql-core';
import { characters } from './character';
import type { ScoreDTO } from '@osu-idle/shared/score';
import { db } from '../client';
import {
	eq,
	and,
	desc,
} from 'drizzle-orm';
import { beatmaps } from './beatmap';
import { beatmapset } from './beatmapset';

const judgeColumn = () => int().notNull().default(0);

type JudgeColumns = { [K in Judgement]: ReturnType<typeof judgeColumn> };

const judgeColumns = Object.fromEntries(
	Judgements.map(judge => [judge, judgeColumn()]),
) as JudgeColumns;

export const scoreTableDefinition = {
	id: int().autoincrement().primaryKey(),
	characterId: int().notNull()
		.references(() => characters.id, { onDelete: 'cascade' }),
	// Plain id (no FK): imported scores can reference beatmaps not yet in the
	// server `beatmap` table.
	beatmapId: int().notNull(),
	score: int().notNull(),
	accuracy: decimal({
		precision: 10, scale: 5, 
	}).notNull(),
	maxCombo: int().notNull(),
	...judgeColumns,
	grade: mysqlEnum(Grades).notNull(),
	pp: decimal({
		precision: 10, scale: 3, 
	}).notNull(),
	ur: decimal({
		precision: 10, scale: 3, 
	}).notNull(),
	pfc: boolean().notNull(),
	playedAt: timestamp().defaultNow(),
};

type ScoreCols = { characterId: AnyMySqlColumn; beatmapId: AnyMySqlColumn };

// Shared across the score / best / best_pp tables (all built from
// scoreTableDefinition): index names are table-scoped in MySQL, so reuse is fine.
// `score` keeps a plain index - a character can have many plays per beatmap.
export const scoreIndexes = (table: ScoreCols & { playedAt: AnyMySqlColumn }) => [
	index('character_beatmap_idx').on(table.characterId, table.beatmapId),
	index('beatmap_idx').on(table.beatmapId),
	// Recent-scores feed: filter by character, read in playedAt order so the
	// LIMIT is served from the index instead of a filesort over every play.
	index('character_playedat_idx').on(table.characterId, table.playedAt),
];

export const scores = mysqlTable('score', scoreTableDefinition, scoreIndexes);

// `best` / `best_pp` hold at most one row per (character, beatmap), so that
// composite is their primary key. Their `id` is not autoincrement - it points
// at the winning row in `score`.
export const bestTableDefinition = {
	...scoreTableDefinition,
	id: int().notNull().references(() => scores.id, { onDelete: 'cascade' }),
};

export const bestConstraints = (table: ScoreCols) => [
	primaryKey({ columns: [table.characterId, table.beatmapId] }),
	index('beatmap_idx').on(table.beatmapId),
];

export type ScoreRow = typeof scores.$inferSelect;
export type NewScoreRow = typeof scores.$inferInsert;

export function toScoreDTO(row: ScoreRow): ScoreDTO {
	const judgements = Object.fromEntries(
		Judgements.map(j => [j, row[j]]),
	) as ScoreDTO['judgements'];

	return {
		id: row.id,
		beatmapId: row.beatmapId,
		characterId: row.characterId,
		grade: row.grade,
		maxCombo: row.maxCombo,
		pfc: row.pfc,
		score: row.score,
		judgements,
		accuracy: parseFloat(row.accuracy),
		pp: parseFloat(row.pp),
		ur: parseFloat(row.ur),
		playedAt: row.playedAt ? row.playedAt.getTime() : 0,
	};
}

export const getScoreById = async (id: number) => {
	const [row] = await db
		.select()
		.from(scores)
		.where(eq(scores.id, id))
		.limit(1);
	return row;
};

export const getCharacterScores = (characterId: number, beatmapId: number) => db
	.select()
	.from(scores)
	.where(
		and(
			eq(scores.characterId, characterId),
			eq(scores.beatmapId, beatmapId),
		));

export const getAllCharacterScores = (characterId: number) => db
	.select()
	.from(scores)
	.where(eq(scores.characterId, characterId));
	
export const getRecentCharacterScores = async (characterId: number, page: number = 1) => {
	return db
		.select()
		.from(scores)
		.innerJoin(beatmaps, eq(beatmaps.id, scores.beatmapId))
		.innerJoin(beatmapset, eq(beatmapset.id, beatmaps.setId))
		.where(eq(scores.characterId, characterId))
		.orderBy(desc(scores.playedAt))
		.offset(page === 1 ? 0 : 5 + ((page - 2) * 50))
		.limit(page === 1 ? 5 : 50)
	;
};