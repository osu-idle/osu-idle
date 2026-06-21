import type { JSX } from 'react';
import { xpForLevel } from '../sim/skills/xp.js';

const ensureNum = (n?: number | string): number => typeof n === 'number' ? n : (parseFloat(n ?? '0'));

const num = (n?: number | string, decimals = 0) => (Math.floor(ensureNum(n) * Math.pow(10, decimals)) / Math.pow(10, decimals)).toLocaleString('en-US');

export const bpm = (n?: number | string) => num(ensureNum(n), ensureNum(n) === Math.floor(ensureNum(n)) ? 3 : 0);

export const level = (level: number, xp: number): string | JSX.Element => {
	const l = String(level);
	if (level < 100) return l;

	const p = Math.floor(xp / xpForLevel(level) * 100);

	return <span className={`level_container level_${l}`}>{l}
		{p > 0 && (
			<span className='level_part' style={{
				opacity: 0.5 + 0.5 * (p / 100)
			}}>.{String(p).padStart(2, '0')}</span>
		)}
	</span>;
};

export const bignum = (n?: number | string | null): string => {
	n = Math.floor(ensureNum(n ?? '0'));

	const transform = (n: number) => {
		const s = String(n).substring(0, 4).padEnd(4, '0');
		return s.charAt(s.length - 1) === '.' ? s.substring(0, s.length - 1) : s;
	};

	if (n < 1000) return String(n);
	if (n < 1000000) return `${transform(n / 1000)}k`;
	if (n < 1000000000) return `${transform(n / 1000000)}M`;
	if (n < 1000000000000) return `${transform(n / 1000000000)}B`;
	return 'a lot';
};

export default num;