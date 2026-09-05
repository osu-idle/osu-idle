import {
	mapped,
	type ValueIn,
} from './helpers/mapped.js';

// XX sits above X: every note divine, not one marvelous. Near impossible, and
// only reachable once a rebirth has unlocked the divine judgement.
export const Grades = ['XX', 'X', 'SS', 'S', 'A', 'B', 'C', 'D', 'F'] as const;
export const GRADE = mapped(Grades);
export type Grade = ValueIn<typeof GRADE>;

export const GoodGrades = ['XX', 'X', 'SS', 'S', 'A'] as const;
export const GOOD_GRADE = mapped(Grades);
export type GoodGrade = ValueIn<typeof GOOD_GRADE>;

export const Judgements = [
	'DIVINE', 'MARVELOUS', 'PERFECT', 'GREAT', 'GOOD', 'BAD', 'MISS',
] as const;
export const JUDGEMENT = mapped(Judgements);
export type Judgement = ValueIn<typeof JUDGEMENT>;

export const compareGrade = (a: Grade, b: Grade) => {
	return Grades.indexOf(a) - Grades.indexOf(b);
};

export const compareGradeGT = (a: Grade, b: Grade): boolean => {
	return compareGrade(a, b) < 0;
};

export const compareGradeGTE = (a: Grade, b: Grade): boolean => {
	return compareGrade(a, b) <= 0;
};