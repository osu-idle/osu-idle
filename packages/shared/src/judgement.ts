import { mapped, type ValueIn } from './helpers/mapped.js';

export const Grades = ['X', 'SS', 'S', 'A', 'B', 'C', 'D', 'F'] as const;
export const GRADE = mapped(Grades);
export type Grade = ValueIn<typeof GRADE>;

export const Judgements = ['MARVELOUS', 'PERFECT', 'GREAT', 'GOOD', 'BAD', 'MISS'] as const;
export const JUDGEMENT = mapped(Judgements);
export type Judgement = ValueIn<typeof JUDGEMENT>;
