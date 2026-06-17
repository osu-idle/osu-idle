import cubic_bezier from '../../math/cubic_bezier.js';

const progressionCurve = cubic_bezier(.1, .4, .95, 0);
const lateProgressionCurve = cubic_bezier(.5, 0, 1, .4);

export const xpForLevel = (level: number): number => {
	return 100
		+ (progressionCurve(level / 100) * 9900)
		+ (lateProgressionCurve((level - 60) / 40) * 90000)
		+ (level >= 100 ? ((level - 99) * 10000000) : 0);
};

export const xpToLevel = (level: number): number => {
	let total = 0;
	for (let i = 0; i < level; i++) {
		total += xpForLevel(i);
	}
	return total;
};

export const xpGivesLevel = (xp: number): { level: number, xp: number } => {
	let level = 0;
	do {
		const nextXP = xpForLevel(level);
		if (xp < nextXP) break;
		xp -= nextXP;
		level++;
	} while(true);
	
	return { level, xp };
};