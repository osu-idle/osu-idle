import {
	describe,
	it,
	expect,
} from 'vitest';
import {
	LEVEL_COLOUR_MAX,
	LEVEL_COLOUR_MIN,
	levelClass,
	levelProgress,
} from '@osu-idle/shared/display/levelDisplay';
import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';

/** The rules every level on screen follows. They live in one helper precisely
 *  so they cannot drift apart between screens - these pin them. */
describe('how a level is drawn', () => {
	it('takes its colour from the ramp while it is on it', () => {
		for (let l = LEVEL_COLOUR_MIN; l <= LEVEL_COLOUR_MAX; l++) {
			expect(levelClass(l)).toBe(`level_container level_${l}`);
		}
	});

	it('keeps the ramp\'s last colour above it, never falling through to none', () => {
		for (const l of [111, 120, 150, 999]) {
			expect(levelClass(l), `level ${l}`)
				.toBe(`level_container level_${LEVEL_COLOUR_MAX}`);
		}
	});

	it('ignores the progress inside the level when picking the colour', () => {
		expect(levelClass(105.99)).toBe(levelClass(105));
	});

	it('reads progress as a fraction of what the next level costs', () => {
		expect(levelProgress(105, 0)).toBe(0);
		expect(levelProgress(105, xpForLevel(105) * 0.45)).toBeCloseTo(0.45, 5);
		expect(levelProgress(105, xpForLevel(105))).toBe(1);
	});

	it('never lets progress leave [0, 1]', () => {
		expect(levelProgress(105, -50)).toBe(0);
		expect(levelProgress(105, xpForLevel(105) * 10)).toBe(1);
	});
});
