import { levelProgress } from '../../display/levelDisplay.js';

/** Effective level (real + prestige bonus) mapped to the level the strain curves
 *  read, as [effective, skill] breakpoints joined by straight lines. Past the
 *  last breakpoint the final slope continues.
 *
 *  The mapping is where progression is paced, and it only ever slows down: past
 *  90 an effective level buys less than a full skill level, so the last stretch
 *  costs many levels per point of real skill. Only the curves see this - the
 *  player is shown their effective level.
 *
 *  Tune the progression here, by moving the breakpoints. The shape to keep:
 *  identity while levelling is normal, then flattening, so that an end-game
 *  character with absurd stats still lands in the low 100s rather than pinning
 *  the curves' ceiling.
 *
 *  One mapping for every skill: per-skill tuning belongs in the skills' own
 *  curves, not in the level axis. */
export type LevelMapping = readonly (readonly [number, number])[];

export const LEVEL_MAPPING: LevelMapping = [
	// effective, skill        slope   what it costs
	[0, 0],
	[90, 90],   //             1       a level is a level
	[110, 100], //             0.5     two levels per point
	[200, 120], //             0.222   four and a half levels per point
];

export const mapLevel = (
	level: number,
	mapping: LevelMapping = LEVEL_MAPPING,
): number => {
	if (level <= 0) return 0;

	for (let i = 1; i < mapping.length; i++) {
		const from = mapping[i - 1];
		const to = mapping[i];
		if (!from || !to) break;

		const [x0, y0] = from;
		const [x1, y1] = to;
		if (x1 === x0) continue;
		if (level <= x1 || i === mapping.length - 1)
			return y0 + (level - x0) * (y1 - y0) / (x1 - x0);
	}

	return level;
};

/** The level the player is shown: their xp level and its progress plus any
 *  prestige bonus. The mapping above is internal to the strain curves - it
 *  never reaches the display, which stays on real levels. */
export const effectiveLevelOf = (level: number, xp: number, prestige = 0): number =>
	level + levelProgress(level, xp) + prestige;
