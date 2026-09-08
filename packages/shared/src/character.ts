import { z } from 'zod';
import { MAX_ACCURACY } from './sim/scoring.js';
import {
	Skills,
	type SkillName,
} from './skills.js';
import {
	Grades,
	type Grade,
} from './judgement.js';
import { pendingActionDTO } from './pendingAction.js';

export const skillProgressDTO = z.object({
	level: z.number().int().min(0),
	xp: z.number().int().min(0),
	upgrades: z.number().int().min(0),
	overdrive: z.number().min(0),
	prestige: z.number().int().min(0),
	/** Xp ever earned on the skill: spending never takes it back. */
	lifetimeXp: z.number().int().min(0),
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
	// Rebirth number, 1 for a first character: its unlock set is the first
	// generation - 1 entries of REBIRTH_UNLOCKS.
	generation: z.number().int().positive(),
	// Drives the rebirth requirement.
	overallLevel: z.number().int().min(0),
	skills: skillsDTO,
	// What a running play has deferred to its end, in the order it was asked for.
	pendingActions: pendingActionDTO.array().optional(),
});
export type CharacterDTO = z.infer<typeof characterDTO>;

/** A character's headline stats - shown on community cards (and reusable by the
 *  profile header). Aggregates that live on the character row / its totals. */
export const characterStatsDTO = z.object({
	pp: z.number().min(0),
	accuracy: z.number().min(0).max(MAX_ACCURACY),
	playCount: z.number().int().min(0),
	level: z.number().int().min(0),
});
export type CharacterStats = z.infer<typeof characterStatsDTO>;

/** Number of personal-best plays achieving each grade (X … F). */
export const gradeCountsDTO = z.object(
	Object.fromEntries(Grades.map(g => [g, z.number().int().min(0)])) as Record<Grade, z.ZodNumber>,
);
export type GradeCounts = z.infer<typeof gradeCountsDTO>;