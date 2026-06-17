import { mapped, values, type ValueIn } from './helpers/mapped.js';

export const GRADE = mapped(['X', 'SS', 'S', 'A', 'B', 'C', 'D', 'F']);
export const Grades = values(GRADE);
export type Grade = ValueIn<typeof GRADE>;

export const JUDGEMENT = mapped(['MARVELOUS', 'PERFECT', 'GREAT', 'GOOD', 'BAD', 'MISS']);
export const Judgements = values(JUDGEMENT);
export type Judgement = ValueIn<typeof JUDGEMENT>;
