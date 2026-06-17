import * as ppjs from 'rosu-pp-js';
import type { ScoreState } from '@osu-idle/shared/sim/scoring';

/**
 * Performance points for a finished play, computed from the raw `.osu` chart and
 * the simulated `ScoreState`. Mirrors the client's `osu/pp.ts` but uses the node
 * `rosu-pp-js` build (synchronous, no wasm init) and the stored chart text.
 */
export function calculatePP(score: ScoreState, chart: string): number {
	const map = new ppjs.Beatmap(chart);
	return new ppjs.Performance({
		lazer: false,

		legacyTotalScore: Math.floor(score.score),
		accuracy: score.accuracy,
		combo: score.maxCombo,

		nGeki: score.counts.MARVELOUS,
		n300: score.counts.PERFECT,
		nKatu: score.counts.GREAT,
		n100: score.counts.GOOD,
		n50: score.counts.BAD,
		misses: score.counts.MISS,
	}).calculate(map).pp;
}
