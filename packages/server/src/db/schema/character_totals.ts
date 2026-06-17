import { bigint, int, mysqlTable } from 'drizzle-orm/mysql-core';
import { characters } from './character';
import { Grades, JUDGEMENT, Judgements, type Grade, type Judgement } from '@osu-idle/shared/judgement';
import { db } from '../client';
import { eq } from 'drizzle-orm';
import type { BestScoreRow } from './best';
import { getBeatmapById } from './beatmap';
import { getAllCharacterScores } from './score';
import { onSubmitScore, recomputePP } from '../../scores';

const totalColumn = () => bigint({ mode: 'number' }).notNull().default(0);

const skillColumns = Judgements.reduce((acc, j) => {
	acc[j] = totalColumn();
	return acc;
}, {} as Record<Judgement, ReturnType<typeof totalColumn>>);

const gradesColumns = Grades.reduce((acc, j) => {
	acc[j] = totalColumn();
	return acc;
}, {} as Record<Grade, ReturnType<typeof totalColumn>>);


export const character_totals = mysqlTable('character_totals', {
	id: int().notNull()
		.references(() => characters.id, { onDelete: 'cascade' }),
	totalScore: totalColumn(),
	rankedScore: totalColumn(),
	hits: totalColumn(),
	playCount: totalColumn(),
	playTime: totalColumn(),
	...skillColumns,
	...gradesColumns,
});

export type CharacterTotalsRow = typeof character_totals.$inferSelect;
export type NewCharacterTotalsRow = typeof character_totals.$inferInsert;


export const getCharacterTotals = async (characterId: number) => {
	let [row] = await db
		.select()
		.from(character_totals)
		.where(eq(character_totals.id, characterId))
		.limit(1);

	if (!row) {
		const newTotals : NewCharacterTotalsRow = {
			id: characterId,
		};

		await db.insert(character_totals).values(newTotals);
		
		[row] = await db
			.select()
			.from(character_totals)
			.where(eq(character_totals.id, characterId))
			.limit(1);

		if (!row) throw new Error('Could not insert character totals ! ' + characterId);

		// Migration: recompute existing scores=
		for (const score of await getAllCharacterScores(characterId)) {
			await onSubmitScore(row, score, false);
		}
		recomputePP(characterId);
	}

	return row;
};

export const updateCharacterTotals = async (totals: CharacterTotalsRow) => db
	.update(character_totals)
	.set(totals)
	.where(eq(character_totals.id, totals.id));

/**
 * Removes the stats that only count the best scores
 * Does not remove the stats that accumulate over ALL scores
 */
export const removeBestScoreFromTotals = (totals: CharacterTotalsRow, score: BestScoreRow) => {
	totals[score.grade] -= 1;
	totals.rankedScore -= score.score;

	for (const judgement of Judgements) {
		totals[judgement] -= score[judgement]; 
	}
};

/**
 * Only adds stats that are counted from best scores
 */
export const addBestScoreToTotals = (totals: CharacterTotalsRow, score: BestScoreRow) => {
	totals[score.grade] += 1;
	totals.rankedScore += score.score;

	for (const judgement of Judgements) {
		totals[judgement] += score[judgement]; 
	}
};

/**
 * Only adds stats that are counted from ALL scores (not necessarily PBs)
 */
export const addScoreToTotals = async (totals: CharacterTotalsRow, score: BestScoreRow) => {
	totals.playCount += 1;
	totals.totalScore += score.score;

	for (const judgement of Judgements) {
		if (judgement === JUDGEMENT.MISS) continue;
		totals.hits += score[judgement]; 
	}

	const beatmap = await getBeatmapById(score.beatmapId);
	if (!beatmap) {
		console.warn('Could not get beatmap id ' + score.beatmapId + ' to count total play time');
		return;
	}

	totals.playTime += beatmap.total_length;
};