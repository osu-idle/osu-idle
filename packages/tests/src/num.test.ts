import {
	describe,
	it,
	expect,
} from 'vitest';
import { bignum } from '@osu-idle/shared/display/num';

describe('bignum', () => {
	it('leaves an unsuffixed number a plain integer', () => {
		expect(bignum(0)).toBe('0');
		expect(bignum(7)).toBe('7');
		expect(bignum(490)).toBe('490');
		expect(bignum(999)).toBe('999');
	});

	it('always carries two decimals once suffixed', () => {
		expect(bignum(10_450)).toBe('10.45k');
		expect(bignum(102_120)).toBe('102.12k');
		expect(bignum(2_820_000)).toBe('2.82M');
		// a whole mantissa keeps its two digits rather than losing them
		expect(bignum(301_000)).toBe('301.00k');
		expect(bignum(1_000)).toBe('1.00k');
		expect(bignum(45_000_000)).toBe('45.00M');
	});

	it('truncates rather than rounding up', () => {
		expect(bignum(4_567)).toBe('4.56k');
		expect(bignum(1_999)).toBe('1.99k');
	});

	it('scales through k, M and B', () => {
		expect(bignum(1_000_000)).toBe('1.00M');
		expect(bignum(1_000_000_000)).toBe('1.00B');
		expect(bignum(1_000_000_000_000)).toBe('a lot');
	});
});
