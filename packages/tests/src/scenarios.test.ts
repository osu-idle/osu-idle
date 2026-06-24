import {
	describe,
	it,
} from 'vitest';
import {
	Expectation,
	runScenario,
} from './balancing/harness';
import {
	SKILL,
	type SkillName,
} from '@osu-idle/shared/skills';
import {
	LEVEL,
	Profile,
	PROFILE,
} from './balancing/experience';
import {
	Bundle,
	MASTERY,
} from './balancing/mastery';
import {
	CHARTS,
	EZ,
	getBeatmap,
	HD,
	IX,
	loadBeatmap,
} from './balancing/charts';

await Promise.all(Object.values(CHARTS).map(loadBeatmap));

const runs = 5;

const check = (
	profile: Profile, 
	goal: string, 
	charts: number | number[],
	bundle: Bundle,
	skill?: SkillName,
) => {
	for (const chart of [charts].flat()) {
		const base = {
			profile, goal, chart, runs, ...bundle, 
		};
		runScenario(skill
			? {
				...base, skill, level: LEVEL[profile], 
			}
			: {
				...base, skills: LEVEL[profile], 
			});
	}
};

const checkMap = (
	chart: number, 
	levels: Record<Profile, Bundle>,
	skill?: SkillName,
	disabled?: (keyof Expectation)[],
) => {
	const beatmap = getBeatmap(chart);
	for (const [profile, bundle] of Object.entries(levels) as [Profile, Bundle][]) {
		const base = {
			profile, goal: 'Map scaling', chart, runs, ...bundle, 
		};
		it(`${profile} | ${beatmap.metadata.title} [${beatmap.metadata.version}]`, () => {
			runScenario(skill
				? {
					...base, skill, level: LEVEL[profile], disabled, 
				}
				: {
					...base, skills: LEVEL[profile], disabled, 
				},
			);
		});
	}
};

describe('beginner capacities', () => {
	it('a new player can at least clear easy charts around B rank', () => {
		const mastery = MASTERY.CLEAR_B;
		mastery.expect.fail = false;
		mastery.tolerance = {
			failRate: 0.25, accuracy: 0.05, 
		};
		check(PROFILE.BEGINNER, 'Minimal capacities', EZ, mastery);
	});

	it('a new player can never clear maps too difficult for him', () => {
		check(PROFILE.BEGINNER, 'Minimal capacities', HD, MASTERY.IMPOSSIBLE);
		check(PROFILE.BEGINNER, 'Minimal capacities', IX, MASTERY.IMPOSSIBLE);
	});
});

describe('accuracy scaling', () => {
	const acc = (profile: Profile, bundle: Bundle) => 
		check(profile, 'Accuracy Baseline', CHARTS['6-aiae'], bundle, 'accuracy');

	it('beginner accuracy results in 85% baseline', () =>
		acc(PROFILE.BEGINNER, {
			expect: { accuracy: 0.85 }, tolerance: { accuracy: 0.03 }, 
		}),
	);

	it('newbie accuracy results in Low A baseline', () =>
		acc(PROFILE.NEWBIE, {
			expect: { accuracy: 0.92 }, tolerance: { accuracy: 0.02 }, 
		}),
	);

	it('casual accuracy results in Low S baseline', () =>
		acc(PROFILE.CASUAL, {
			expect: { accuracy: 0.95 }, tolerance: { accuracy: 0.02 }, 
		}),
	);

	it('regular accuracy results in High S baseline', () =>
		acc(PROFILE.REGULAR, {
			expect: { accuracy: 0.985 }, tolerance: { accuracy: 0.01 }, 
		}),
	);

	it('confirmed accuracy results in low SS baseline', () =>
		acc(PROFILE.CONFIRMED, {
			expect: {
				accuracy: 1, ratio: 2, 
			}, tolerance: {
				accuracy: 0.01, ratio: 1.5, 
			}, 
		}),
	);

	it('seasoned accuracy results in mid SS baseline', () =>
		acc(PROFILE.SEASONED, {
			expect: {
				accuracy: 1, ratio: 4, 
			}, tolerance: {
				accuracy: 0.005, ratio: 1.5, 
			}, 
		}),
	);

	it('good accuracy results in high SS baseline', () =>
		acc(PROFILE.GOOD, {
			expect: {
				accuracy: 1, ratio: 15, 
			}, tolerance: {
				accuracy: 0.005, ratio: 1.5, 
			}, 
		}),
	);

	it('expert accuracy results in top SS baseline', () =>
		acc(PROFILE.EXPERT, {
			expect: {
				accuracy: 1, ratio: 50, 
			}, tolerance: {
				accuracy: 0.002, ratio: 1.5, 
			}, 
		}),
	);

	it('pro accuracy results in X baseline', () =>
		acc(PROFILE.PRO, {
			expect: {
				accuracy: 1, ratio: 300, 
			}, tolerance: {
				accuracy: 0, ratio: 1.5, 
			}, 
		}),
	);
});

describe('jacks scaling', () => {
	checkMap(CHARTS['vital vitriol 1.0'], {
		[PROFILE.BEGINNER]: MASTERY.IMPOSSIBLE,
		[PROFILE.NEWBIE]: MASTERY.IMPOSSIBLE,
		[PROFILE.CASUAL]: MASTERY.IMPOSSIBLE,
		[PROFILE.REGULAR]: MASTERY.IMPOSSIBLE,
		[PROFILE.CONFIRMED]: MASTERY.IMPOSSIBLE,
		[PROFILE.SEASONED]: MASTERY.IMPOSSIBLE,
		[PROFILE.GOOD]: MASTERY.B,
		[PROFILE.EXPERT]: MASTERY.LOW_S,
		[PROFILE.PRO]: MASTERY.LOW_SS,
	}, SKILL.jackspeed, ['ratio']);
});

describe('global scaling', () => {
	checkMap(CHARTS['6-aiae'], {
		[PROFILE.BEGINNER]: MASTERY.IMPOSSIBLE,
		[PROFILE.NEWBIE]: MASTERY.IMPOSSIBLE,
		[PROFILE.CASUAL]: MASTERY.IMPOSSIBLE,
		[PROFILE.REGULAR]: MASTERY.IMPOSSIBLE,
		[PROFILE.CONFIRMED]: MASTERY.IMPOSSIBLE,
		[PROFILE.SEASONED]: MASTERY.IMPOSSIBLE,
		[PROFILE.GOOD]: MASTERY.B,
		[PROFILE.EXPERT]: MASTERY.A,
		[PROFILE.PRO]: MASTERY.HIGH_S,
	});
	
	checkMap(CHARTS['6-shaper'], {
		[PROFILE.BEGINNER]: MASTERY.IMPOSSIBLE,
		[PROFILE.NEWBIE]: MASTERY.IMPOSSIBLE,
		[PROFILE.CASUAL]: MASTERY.IMPOSSIBLE,
		[PROFILE.REGULAR]: MASTERY.IMPOSSIBLE,
		[PROFILE.CONFIRMED]: MASTERY.IMPOSSIBLE,
		[PROFILE.SEASONED]: MASTERY.B,
		[PROFILE.GOOD]: MASTERY.S,
		[PROFILE.EXPERT]: MASTERY.HIGH_S,
		[PROFILE.PRO]: MASTERY.LOW_SS,
	});
	
	checkMap(CHARTS['5-c18'], {
		[PROFILE.BEGINNER]: MASTERY.IMPOSSIBLE,
		[PROFILE.NEWBIE]: MASTERY.IMPOSSIBLE,
		[PROFILE.CASUAL]: MASTERY.IMPOSSIBLE,
		[PROFILE.REGULAR]: MASTERY.IMPOSSIBLE,
		[PROFILE.CONFIRMED]: MASTERY.B,
		[PROFILE.SEASONED]: MASTERY.S,
		[PROFILE.GOOD]: MASTERY.HIGH_S,
		[PROFILE.EXPERT]: MASTERY.LOW_SS,
		[PROFILE.PRO]: MASTERY.SS,
	});
	
	checkMap(CHARTS['1-refresh'], {
		[PROFILE.BEGINNER]: MASTERY.B,
		[PROFILE.NEWBIE]: MASTERY.A,
		[PROFILE.CASUAL]: MASTERY.LOW_S,
		[PROFILE.REGULAR]: MASTERY.HIGH_S,
		[PROFILE.CONFIRMED]: MASTERY.LOW_SS,
		[PROFILE.SEASONED]: MASTERY.SS,
		[PROFILE.GOOD]: MASTERY.HIGH_SS,
		[PROFILE.EXPERT]: MASTERY.HIGH_SS,
		[PROFILE.PRO]: MASTERY.X,
	});
	
	checkMap(CHARTS['4.5-tokyo'], {
		[PROFILE.BEGINNER]: MASTERY.IMPOSSIBLE,
		[PROFILE.NEWBIE]: MASTERY.IMPOSSIBLE,
		[PROFILE.CASUAL]: MASTERY.IMPOSSIBLE,
		[PROFILE.REGULAR]: MASTERY.LUCK,
		[PROFILE.CONFIRMED]: MASTERY.LOW_B,
		[PROFILE.SEASONED]: MASTERY.HIGH_A,
		[PROFILE.GOOD]: MASTERY.HIGH_S,
		[PROFILE.EXPERT]: MASTERY.LOW_SS,
		[PROFILE.PRO]: MASTERY.SS,
	});
});
