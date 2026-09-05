import type { Grade } from '@osu-idle/shared/judgement';

/** Headline grades shown in the totals block (best play per beatmap). */
const GRADE_DISPLAY = ['XX', 'X', 'SS', 'S', 'A'] as const;

/** Only shown once earned. XX needs a rebirth unlock and X a flawless play, so
 *  for most characters a zero there is the normal state rather than a total
 *  worth reporting - and an empty XX reads as a grade they failed to get. */
const WHEN_EARNED: readonly Grade[] = ['XX', 'X'];

export type HeadlineGrade = (typeof GRADE_DISPLAY)[number];

/** The grades this character's totals block should carry, in display order. */
export const headlineGrades = (
	counts: Record<HeadlineGrade, number>,
): readonly HeadlineGrade[] =>
	GRADE_DISPLAY.filter(g => !WHEN_EARNED.includes(g) || counts[g] > 0);
