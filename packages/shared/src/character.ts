import { z } from 'zod';
import {
	Skills,
	type SkillName,
} from './skills.js';
import {
	Grades,
	type Grade,
} from './judgement.js';

export const skillProgressDTO = z.object({
	level: z.number().int().min(0),
	xp: z.number().int().min(0),
});
export type SkillProgressDTO = z.infer<typeof skillProgressDTO>;

/** Per-skill progress for every skill - the character's full progression. */
export const skillsDTO = z.object(
	Object.fromEntries(Skills.map(s => [s, skillProgressDTO])) as Record<
		SkillName,
		typeof skillProgressDTO
	>,
);
export type SkillsDTO = z.infer<typeof skillsDTO>;

export const characterDTO = z.object({
	id: z.number().int().positive(),
	userId: z.number().int().positive(),
	name: z.string(),
	// The character's profile picture, always a usable absolute URL: its custom
	// upload, else the account's osu! avatar, else the guest default.
	avatarUrl: z.string(),
	// The account's osu! country code. Absent for the local Guest.
	country: z.string().optional(),
	skills: skillsDTO,
});
export type CharacterDTO = z.infer<typeof characterDTO>;

/** A character's headline stats - shown on community cards (and reusable by the
 *  profile header). Aggregates that live on the character row / its totals. */
export const characterStatsDTO = z.object({
	pp: z.number().min(0),
	accuracy: z.number().min(0).max(1),
	playCount: z.number().int().min(0),
	level: z.number().int().min(0),
});
export type CharacterStats = z.infer<typeof characterStatsDTO>;

/** Number of personal-best plays achieving each grade (X … F). */
export const gradeCountsDTO = z.object(
	Object.fromEntries(Grades.map(g => [g, z.number().int().min(0)])) as Record<Grade, z.ZodNumber>,
);
export type GradeCounts = z.infer<typeof gradeCountsDTO>;