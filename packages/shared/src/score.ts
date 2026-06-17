import { z } from 'zod';
import { Grades, Judgements, type Judgement } from './judgement.js';

export const judgementCountsDTO = z.object(
	Object.fromEntries(
		Judgements.map(j => [j, z.number().int().min(0)]),
	) as Record<Judgement, z.ZodNumber>,
);
export type JudgementCounts = z.infer<typeof judgementCountsDTO>;

export const scoreDTO = z.object({
	id: z.number().int().positive(),
	characterId: z.number().int().positive(),
	beatmapId: z.number().int(),
	score: z.number().int().min(0),
	accuracy: z.number().min(0).max(1),
	maxCombo: z.number().int().min(0),
	judgements: judgementCountsDTO,
	grade: z.enum(Grades),
	pp: z.number().min(0),
	ur: z.number().min(0),
	pfc: z.boolean(),
	playedAt: z.number().int(), // epoch ms
});
export type ScoreDTO = z.infer<typeof scoreDTO>;
