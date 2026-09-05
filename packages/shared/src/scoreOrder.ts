/**
 * Which of two plays is better - the single rule, used everywhere plays are
 * ranked against each other.
 *
 * It lived in two places that had to agree and did not: the best-of-a-beatmap
 * comparison and the leaderboard's sort value. Divine broke the disagreement
 * open, because it leaves score at the 1M cap and raises accuracy instead - so
 * ordering by score alone ties every top play and whoever arrived first keeps
 * the place for good.
 */

/** The parts of a play the ordering reads. */
export type Rankable = {
	score: number,
	/** decimal columns come back as strings */
	accuracy: number | string,
	/** lower id = set earlier */
	id: number,
};

/** Five decimals of accuracy, packed under the score. */
const ACCURACY_UNITS = 100_000;
const SCORE_UNITS = 1_000_000;

/**
 * A single sortable number: score in the high digits, accuracy below it. Redis
 * holds sorted-set scores as float64, and the largest value here (1M score,
 * ~1.01 accuracy) is ~1e12 - exact well inside 2^53.
 *
 * Must order identically to {@link betterScore}; that is the whole point of both
 * living here.
 */
export const rankValue = (score: number, accuracy: number | string): number =>
	score * SCORE_UNITS + Math.round(Number(accuracy) * ACCURACY_UNITS);

/** Whether `a` beats `b`: score, then accuracy, then whoever set it first. */
export const betterScore = (a: Rankable, b: Rankable): boolean => {
	const byValue = rankValue(a.score, a.accuracy) - rankValue(b.score, b.accuracy);
	if (byValue !== 0) return byValue > 0;
	return a.id < b.id;
};

/**
 * The same value as {@link rankValue}, for the local SQL that has to sort in the
 * query. `prefix` qualifies the columns (`'s.'`).
 */
export const rankValueSQL = (prefix = ''): string =>
	`(${prefix}score * ${SCORE_UNITS} + ROUND(${prefix}accuracy * ${ACCURACY_UNITS}))`;
