import { describe, it, expect } from 'vitest';
import { ScoreState, maniaWindows, judge, judgeHold, MAX_HP } from '@osu-idle/shared/sim/scoring';
import { JUDGEMENT, GRADE, type Judgement } from '@osu-idle/shared/judgement';

/** Build a finished {@link ScoreState} by feeding `[judgement, count]` runs in order. */
function play(od: number, maxObjects: number, runs: [Judgement, number][]): ScoreState {
	const s = new ScoreState(od, maxObjects);
	for (const [j, n] of runs) for (let i = 0; i < n; i++) s.add(j);
	return s;
}

describe('maniaWindows', () => {
	it('matches the stable formula at OD 0', () => {
		const w = maniaWindows(0);
		expect(w).toEqual({
			[JUDGEMENT.MARVELOUS]: 16.5,
			[JUDGEMENT.PERFECT]: 64,
			[JUDGEMENT.GREAT]: 97,
			[JUDGEMENT.GOOD]: 127,
			[JUDGEMENT.BAD]: 151,
			[JUDGEMENT.MISS]: 188,
		});
	});

	it('tightens every window except MARVELOUS by 3ms per OD', () => {
		const w = maniaWindows(5);
		expect(w[JUDGEMENT.MARVELOUS]).toBe(16.5); // fixed, OD-independent
		expect(w[JUDGEMENT.PERFECT]).toBe(49);
		expect(w[JUDGEMENT.GREAT]).toBe(82);
		expect(w[JUDGEMENT.GOOD]).toBe(112);
		expect(w[JUDGEMENT.BAD]).toBe(136);
		expect(w[JUDGEMENT.MISS]).toBe(173);
	});
});

describe('judge', () => {
	const w = maniaWindows(0);
	it.each<[number, Judgement]>([
		[0, JUDGEMENT.MARVELOUS],
		[16.5, JUDGEMENT.MARVELOUS], // inclusive upper edge
		[16.6, JUDGEMENT.PERFECT],
		[64, JUDGEMENT.PERFECT],
		[64.1, JUDGEMENT.GREAT],
		[97, JUDGEMENT.GREAT],
		[127, JUDGEMENT.GOOD],
		[151, JUDGEMENT.BAD],
		[151.1, JUDGEMENT.MISS], // anything past the BAD window is a miss
		[500, JUDGEMENT.MISS],
	])('classifies %dms as %s', (offset, expected) => {
		expect(judge(offset, w)).toBe(expected);
	});
});

describe('judgeHold', () => {
	// OD0 windows: MARVELOUS 16.5, PERFECT 64, GREAT 97, GOOD 127, BAD 151.
	// A long note's single judgement needs both a tight head and a tight combined
	// (head + tail) error; the multipliers come straight from the mania table.
	const w = maniaWindows(0);
	it.each<[number, number, Judgement]>([
		[0, 0, JUDGEMENT.MARVELOUS],
		[19.8, 19.8, JUDGEMENT.MARVELOUS], // head ≤16.5×1.2, combined ≤16.5×2.4 (edges)
		[19.9, 0, JUDGEMENT.PERFECT], // head past MARVELOUS×1.2 drops a tier
		[10, 30, JUDGEMENT.PERFECT], // combined past MARVELOUS×2.4 drops a tier
		[70, 70, JUDGEMENT.PERFECT], // head ≤64×1.1, combined ≤64×2.2 (edges)
		[71, 0, JUDGEMENT.GREAT],
		[97, 97, JUDGEMENT.GREAT], // head ≤97, combined ≤97×2 (edges)
		[98, 0, JUDGEMENT.GOOD],
		[127, 127, JUDGEMENT.GOOD], // head ≤127, combined ≤127×2 (edges)
		[128, 0, JUDGEMENT.BAD], // head past the GOOD window: floor at BAD/MEH
		[10, 300, JUDGEMENT.BAD], // a clean head can't save a far-off release
	])('judges head %dms + tail %dms as %s', (head, tail, expected) => {
		expect(judgeHold(head, tail, w)).toBe(expected);
	});

	it('never returns MISS - outright misses are the caller\'s to decide', () => {
		expect(judgeHold(1000, 1000, w)).toBe(JUDGEMENT.BAD);
	});
});

describe('ScoreState scoring', () => {
	// These exact totals are the regression anchors: if the scoring formula
	// changes, these break loudly.
	it('awards exactly 1,000,000 for an all-MARVELOUS play', () => {
		const s = play(8, 50, [[JUDGEMENT.MARVELOUS, 50]]);
		expect(s.score).toBeCloseTo(1_000_000, 6);
	});

	it('awards 968,750 for an all-PERFECT play (300/320 base, full bonus)', () => {
		const s = play(8, 50, [[JUDGEMENT.PERFECT, 50]]);
		expect(s.score).toBeCloseTo(968_750, 6);
	});

	it('scores fewer points the worse the judgements, monotonically', () => {
		const marv = play(8, 20, [[JUDGEMENT.MARVELOUS, 20]]).score;
		const perfect = play(8, 20, [[JUDGEMENT.PERFECT, 20]]).score;
		const great = play(8, 20, [[JUDGEMENT.GREAT, 20]]).score;
		const miss = play(8, 20, [[JUDGEMENT.MISS, 20]]).score;
		expect(marv).toBeGreaterThan(perfect);
		expect(perfect).toBeGreaterThan(great);
		expect(great).toBeGreaterThan(miss);
		expect(miss).toBe(0);
	});
});

describe('ScoreState combo & accuracy', () => {
	it('tracks combo, resets it on a miss, and remembers the peak', () => {
		const s = play(8, 0, [
			[JUDGEMENT.MARVELOUS, 1],
			[JUDGEMENT.PERFECT, 1],
			[JUDGEMENT.GREAT, 1],
			[JUDGEMENT.MISS, 1],
			[JUDGEMENT.MARVELOUS, 1],
		]);
		expect(s.maxCombo).toBe(3); // M, P, G before the miss
		expect(s.combo).toBe(1); // rebuilt after the miss
		expect(s.counts).toMatchObject({
			[JUDGEMENT.MARVELOUS]: 2,
			[JUDGEMENT.PERFECT]: 1,
			[JUDGEMENT.GREAT]: 1,
			[JUDGEMENT.MISS]: 1,
		});
		expect(s.accuracy).toBeCloseTo(3.66 / 5, 10); // (1+1+0.66+0+1)/5
	});

	it('reports perfect accuracy for an empty state', () => {
		expect(new ScoreState(8).accuracy).toBe(1);
	});
});

describe('ScoreState grades', () => {
	it('is X (SS-perfect) only when every hit is MARVELOUS', () => {
		expect(play(8, 10, [[JUDGEMENT.MARVELOUS, 10]]).grade).toBe(GRADE.X);
	});

	it('is SS at 100% accuracy with at least one non-MARVELOUS hit', () => {
		expect(play(8, 20, [[JUDGEMENT.PERFECT, 20]]).grade).toBe(GRADE.SS);
	});

	// PERFECT = 1.0 acc, MISS = 0.0, so accuracy is exactly perfects/total.
	it.each<[number, number, string]>([
		[19, 1, GRADE.S], // 95%
		[18, 2, GRADE.A], // 90%
		[16, 4, GRADE.B], // 80%
		[14, 6, GRADE.C], // 70%
		[10, 10, GRADE.D], // 50%
	])('%d PERFECT + %d MISS → %s', (perfect, miss, grade) => {
		const s = play(8, 20, [[JUDGEMENT.PERFECT, perfect], [JUDGEMENT.MISS, miss]]);
		expect(s.failed).toBe(false); // accuracy grade only applies to a surviving play
		expect(s.grade).toBe(grade);
	});
});

describe('ScoreState HP & failure', () => {
	it('starts at full HP and survives a clean play', () => {
		const s = play(8, 10, [[JUDGEMENT.MARVELOUS, 10]]);
		expect(s.hp).toBe(MAX_HP);
		expect(s.failed).toBe(false);
		expect(s.failedIndex).toBe(-1);
	});

	it('fails the instant HP reaches 0 and records the 1-based index', () => {
		// HP 100, MISS at OD 8 = -(8+1)*0.75 = -6.75 → 0 on the 15th miss
		// (14*6.75 = 94.5, HP 5.5; the 15th drops below 0 and clamps).
		const s = play(8, 0, [[JUDGEMENT.MISS, 20]]);
		expect(s.failed).toBe(true);
		expect(s.failedIndex).toBe(15); // first time it hit 0, not the last
		expect(s.hp).toBe(0);
		expect(s.grade).toBe(GRADE.D); // a failed play is always D
	});

	it('never lets HP exceed the cap', () => {
		const s = play(8, 0, [[JUDGEMENT.MARVELOUS, 100]]);
		expect(s.hp).toBe(MAX_HP);
	});
});
