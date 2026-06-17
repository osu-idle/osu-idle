/**
 * Client-side re-export of the shared mania scoring engine, plus the judgement /
 * grade colour maps (UI-only, so they stay client-side). Importers keep pulling
 * `ScoreState`, `judge`, `maniaWindows`, `HitWindows` etc. from here.
 */
export * from '@osu-idle/shared/sim/scoring';

import { GRADE, JUDGEMENT, type Grade, type Judgement } from '@osu-idle/shared/judgement';

export const JUDGEMENT_COLORS: {[key in Judgement]: string} = {
	[JUDGEMENT.MARVELOUS]: '#ffe88a',
	[JUDGEMENT.PERFECT]: '#ffd24a',
	[JUDGEMENT.GREAT]: '#6fe07a',
	[JUDGEMENT.GOOD]: '#4aa6ff',
	[JUDGEMENT.BAD]: '#b06bd6',
	[JUDGEMENT.MISS]: '#ff5a72',
};

export const GRADE_COLORS: {[key in Grade]: string} = {
	[GRADE.X]: '#cc4aff',
	[GRADE.SS]: '#ffd24a',
	[GRADE.S]: '#ffe88a',
	[GRADE.A]: '#6fe07a',
	[GRADE.B]: '#4aa6ff',
	[GRADE.C]: '#b06bd6',
	[GRADE.D]: '#ff5a72',
	[GRADE.F]: '#ff5a72',
};
