import { z } from 'zod';
import { Skills, type SkillName } from './skills.js';
import { Grades, type Grade } from './judgement.js';

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
	skills: skillsDTO,
});
export type CharacterDTO = z.infer<typeof characterDTO>;

/** Number of personal-best plays achieving each grade (X … F). */
export const gradeCountsDTO = z.object(
	Object.fromEntries(Grades.map(g => [g, z.number().int().min(0)])) as Record<Grade, z.ZodNumber>,
);
export type GradeCounts = z.infer<typeof gradeCountsDTO>;