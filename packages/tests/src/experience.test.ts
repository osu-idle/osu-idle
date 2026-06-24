import {
	describe,
	it,
} from 'vitest';
import { SKILL } from '@osu-idle/shared/skills';
import {
	CHARTS,
	getBeatmap,
	loadBeatmap,
} from './balancing/charts';
import {
	runXPScenario,
	type XPExpectation,
	type XPScenario,
} from './balancing/experience-harness';
import {
	PROFILE,
	type Profile,
} from './balancing/experience';

await Promise.all(Object.values(CHARTS).map(loadBeatmap));

// 'accuracy',
// 'speed',
// 'stamina',
// 'jackspeed',
// 'coordination',
// 'release',
// 'reading',
// 'consistency',
// 'concentration',
// 'speedjam',
// 'memory',

const runs = 10;

/** Declare one (profile, chart) XP check as a vitest case. */
const xp = (
	profile: Profile, 
	chart: number | number[], 
	expect: XPExpectation, 
	opts: Partial<XPScenario> = {},
) => {
	for (const c of Array.isArray(chart) ? chart : [chart]) {
		const beatmap = getBeatmap(c);
		it(
			`${profile} | ${beatmap.metadata.title} [${beatmap.metadata.version}]`
			, { timeout: 60000 }, () => {
				runXPScenario({
					profile, chart: c, runs, expect, ...opts, 
				});
			});
	}
};

describe('beginner XP', () => {
	// Small gains on short maps
	xp(PROFILE.BEGINNER, CHARTS['1-refresh'], {
		[SKILL.accuracy]: 200,
		[SKILL.stamina]: 0,
		[SKILL.jackspeed]: 0,
		[SKILL.coordination]: 0,
		[SKILL.release]: 0,
		[SKILL.reading]: 0,
		[SKILL.consistency]: 0,
		[SKILL.concentration]: 0,
		[SKILL.speedjam]: 0,
		[SKILL.memory]: 0,
	});
	
	// Normal gains on longer maps but concentration kicks in
	xp(PROFILE.BEGINNER, CHARTS['cyanine beginner'], {
		[SKILL.accuracy]: 400,
		[SKILL.stamina]: 0,
		[SKILL.jackspeed]: 0,
		[SKILL.coordination]: 0,
		[SKILL.release]: 0,
		[SKILL.reading]: 0,
		[SKILL.consistency]: 0,
		[SKILL.concentration]: 100,
		[SKILL.speedjam]: 0,
		[SKILL.memory]: 0,
	});
	
	// Larger acc gains on low density, long maps (also test for LN)
	xp(PROFILE.BEGINNER, CHARTS['first 1.13*'], {
		[SKILL.accuracy]: 800,
		[SKILL.coordination]: 100,
		[SKILL.release]: 150,
		[SKILL.concentration]: 100,
	});
});

describe('no XP gains on lower level charts', () => {
	xp(PROFILE.SEASONED, CHARTS['1-refresh'], { total: 0 });
	
	xp(PROFILE.SEASONED, CHARTS['cyanine beginner'], { total: 0 });
});

describe('mid level accuracy XP', () => {

	// Low XP on short maps
	xp(PROFILE.SEASONED, CHARTS['wing of zero 3.14*'], { [SKILL.accuracy]: 400 });

	// Regular XP on long maps
	xp(PROFILE.SEASONED, CHARTS['she sings in the morning 3.18*'], { [SKILL.accuracy]: 1000 });

	// Big XP on long maps
	xp(PROFILE.SEASONED, CHARTS['blue army 3.15*'], { [SKILL.accuracy]: 2000 });
});