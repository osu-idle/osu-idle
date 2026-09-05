import {
	describe,
	it,
	expect,
} from 'vitest';
import {
	betterScore,
	rankValue,
} from '@osu-idle/shared/scoreOrder';

const play = (score: number, accuracy: number | string, id: number) => ({
	score, accuracy, id,
});

describe('which play is better', () => {
	it('takes the higher score first', () => {
		expect(betterScore(play(900_000, 0.99, 2), play(800_000, 1.0, 1))).toBe(true);
	});

	it('breaks a tie on accuracy - what divine actually raises', () => {
		// both capped at 1M; the divine play reads above 100%
		const divine = play(1_000_000, 1.00651, 20);
		const clean = play(1_000_000, 1, 1);
		expect(betterScore(divine, clean)).toBe(true);
		expect(betterScore(clean, divine)).toBe(false);
	});

	it('falls back to whoever set it first', () => {
		expect(betterScore(play(1_000_000, 1, 5), play(1_000_000, 1, 2))).toBe(false);
		expect(betterScore(play(1_000_000, 1, 2), play(1_000_000, 1, 5))).toBe(true);
	});

	it('reads accuracy that arrives as a decimal string', () => {
		expect(betterScore(play(1_000_000, '1.01000', 9), play(1_000_000, '1.00000', 1))).toBe(true);
	});

	it('orders the packed value the same way it compares', () => {
		const rows = [
			play(1_000_000, 1.01, 3),
			play(1_000_000, 1, 1),
			play(999_999, 1.01, 2),
			play(500_000, 0.9, 4),
		];
		const value = (r: typeof rows[number]) => rankValue(r.score, r.accuracy);
		const byValue = [...rows].sort((a, b) => value(b) - value(a));
		const byCompare = [...rows].sort((a, b) => (betterScore(a, b) ? -1 : 1));
		expect(byValue.map(r => r.id)).toEqual(byCompare.map(r => r.id));
	});

	it('stays exact in a float64, which is what redis stores', () => {
		const most = rankValue(1_000_000, 1.01);
		expect(Number.isSafeInteger(most)).toBe(true);
		expect(most).toBeLessThan(Number.MAX_SAFE_INTEGER);
		// one accuracy step still separates two capped plays
		expect(rankValue(1_000_000, 1.00001) - rankValue(1_000_000, 1)).toBe(1);
	});
});
