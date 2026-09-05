import type { ReactNode } from 'react';
import { xpForLevel } from '../sim/skills/xp.js';
import { levelFromXp } from './levelDisplay.js';

const ensureNum = (n?: number | string): number =>
	typeof n === 'number' ? n : parseFloat(n ?? '0');

const num = (
	n?: number | string,
	decimals = 0,
) => {
	const v = Math.floor(ensureNum(n) * Math.pow(10, decimals))
		/ Math.pow(10, decimals);
	return v.toLocaleString('en-US');
};

export const bpm = (n?: number | string) =>
	num(
		ensureNum(n),
		ensureNum(n) === Math.floor(ensureNum(n)) ? 3 : 0,
	);

/** Plain-text `level()`: "100.07" past level 100, for string-only contexts. */
export const levelText = (level: number, xp: number): string => {
	if (level < 100) return String(level);
	const p = Math.floor(xp / xpForLevel(level) * 100);
	return p > 0 ? `${level}.${String(p).padStart(2, '0')}` : String(level);
};

/** A skill or overall level. The drawing rules live in levelDisplay. */
export const level = (level: number, xp: number): ReactNode => levelFromXp(level, xp);

export const bignum = (n?: number | string | null): string => {
	n = Math.floor(ensureNum(n ?? '0'));

	// a suffixed value always carries exactly two decimals (10.45k, 102.12k,
	// 2.82M), truncated rather than rounded so it never reads higher than it is
	const transform = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);

	if (n < 1000) return String(n);
	if (n < 1000000) return `${transform(n / 1000)}k`;
	if (n < 1000000000) return `${transform(n / 1000000)}M`;
	if (n < 1000000000000) return `${transform(n / 1000000000)}B`;
	return 'a lot';
};

export default num;