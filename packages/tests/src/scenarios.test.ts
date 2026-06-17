import { describe, it } from 'vitest';
import { runScenario, type Expectation, type Tolerance, type Bounds } from './harness';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';
import type { SkillName } from '@osu-idle/shared/skills';
import { GRADE } from '@osu-idle/shared/judgement';
import { loadBeatmap } from './sim';

const runs = 10;

const PROFILE = mapped([
	'Beginner',
	'Newbie',
	'Casual',
	'Regular',
	'Confirmed',
	'Seasoned',
	'Good',
	'Expert',
	'Pro'
]);
type Profile = ValueIn<typeof PROFILE>;

const LEVEL: {[key in Profile]: number} = {
	[PROFILE.Beginner]: 0,
	[PROFILE.Newbie]: 5,
	[PROFILE.Casual]: 10,
	[PROFILE.Regular]: 20,
	[PROFILE.Confirmed]: 30,
	[PROFILE.Seasoned]: 50,
	[PROFILE.Good]: 75,
	[PROFILE.Expert]: 90,
	[PROFILE.Pro]: 100,
} as const;

type Bundle = { expect: Expectation; tolerance?: Tolerance; bounds?: Bounds };

const MASTERY = {
	IMPOSSIBLE: { expect: { fail: true }, tolerance: { failRate: 0 } },
	LUCK: { expect: { fail: true }, tolerance: { failRate: 0.25 } },
	LOW_B: { expect: { accuracy: 0.8 }, tolerance: { accuracy: 0.1 } },
	CLEAR_B: { expect: { accuracy: 0.85, fail: false }, tolerance: { accuracy: 0.05, failRate: 0 } },
	B: { expect: { accuracy: 0.85, fail: false }, tolerance: { accuracy: 0.05, failRate: 1 } },
	HARD_A: { expect: { accuracy: 0.925, fail: false }, tolerance: { accuracy: 0.025, failRate: 0.50 } },
	A: { expect: { accuracy: 0.925, fail: false }, tolerance: { accuracy: 0.025, failRate: 0.50 } },
	HIGH_A: { expect: { accuracy: 0.94, fail: false }, tolerance: { accuracy: 0.02, failRate: 0.50 } },
	LOW_S: { expect: { accuracy: 0.96, fail: false }, tolerance: { accuracy: 0.015, failRate: 0.25 } },
	S: { expect: { accuracy: 0.97, fail: false }, tolerance: { accuracy: 0.02, failRate: 0.25 } },
	HIGH_S: { expect: { accuracy: 0.9825, fail: false }, tolerance: { accuracy: 0.0175, failRate: 0.25 } },
	LOW_SS: { expect: { accuracy: 0.99, ratio: 5, fail: false }, bounds: { accuracy: 'gte', ratio: 'lte' } },
	SS: { expect: { accuracy: 1, ratio: 6, fail: false }, tolerance: { accuracy: 0.005, ratio: 2.5 } },
	HIGH_SS: { expect: { accuracy: 1, ratio: 10, fail: false }, tolerance: { accuracy: 0.005 }, bounds: { ratio: 'gte'} },
	X: { expect: { grade: GRADE.X, fail: false }, tolerance: { gradeRate: 0.1 } },
} as const satisfies Record<string, Bundle>;

const easy_maps = ['1-eternal-white', '1-refresh', '1-this-will-be-the-day'];
const hard_maps = ['3-baku', '3-haru'];
const insane_maps = ['4-blu', '4-dream', '4-soul'];

const check = (profile: Profile, goal: string, charts: string | string[], bundle: Bundle, skill?: SkillName) => {
	for (const chart of [charts].flat()) {
		const base = { profile, goal, chart, runs, ...bundle };
		runScenario(skill
			? { ...base, skill, level: LEVEL[profile] }
			: { ...base, skills: LEVEL[profile] });
	}
};

const checkMap = (chart: string, levels: Record<Profile, Bundle>, skill?: SkillName) => {
	const beatmap = loadBeatmap(`${chart}.osu`);
	for (const [profile, bundle] of Object.entries(levels) as [Profile, Bundle][]) {
		const base = { profile, goal: 'Map scaling', chart, runs, ...bundle };
		it(`${profile} | ${beatmap.metadata.title} [${beatmap.metadata.version}]`, () => {
			runScenario(skill
				? { ...base, skill, level: LEVEL[profile] }
				: { ...base, skills: LEVEL[profile] },
			);
		});
	}
};

describe('beginner capacities', () => {
	it('a new player can at least clear easy charts around B rank', () => {
		const mastery = MASTERY.CLEAR_B as Bundle;
		mastery.expect.fail = false;
		mastery.tolerance = { failRate: 0.25, accuracy: 0.05 };
		check(PROFILE.Beginner, 'Minimal capacities', easy_maps, mastery);
	});

	it('a new player can never clear maps too difficult for him', () => {
		check(PROFILE.Beginner, 'Minimal capacities', hard_maps, MASTERY.IMPOSSIBLE);
		check(PROFILE.Beginner, 'Minimal capacities', insane_maps, MASTERY.IMPOSSIBLE);
	});
});

describe('accuracy scaling', () => {
	const acc = (profile: Profile, bundle: Bundle) => check(profile, 'Accuracy Baseline', '6-aiae', bundle, 'accuracy');

	it('beginner accuracy results in 85% baseline', () =>
		acc(PROFILE.Beginner, { expect: { accuracy: 0.85 }, tolerance: { accuracy: 0.03 } })
	);

	it('newbie accuracy results in Low A baseline', () =>
		acc(PROFILE.Newbie, { expect: { accuracy: 0.92 }, tolerance: { accuracy: 0.02 } })
	);

	it('casual accuracy results in Low S baseline', () =>
		acc(PROFILE.Casual, { expect: { accuracy: 0.95 }, tolerance: { accuracy: 0.02 } })
	);

	it('regular accuracy results in High S baseline', () =>
		acc(PROFILE.Regular, { expect: { accuracy: 0.985 }, tolerance: { accuracy: 0.01 } })
	);

	it('confirmed accuracy results in low SS baseline', () =>
		acc(PROFILE.Confirmed, { expect: { accuracy: 1, ratio: 2 }, tolerance: { accuracy: 0.01, ratio: 1.5 } })
	);

	it('seasoned accuracy results in mid SS baseline', () =>
		acc(PROFILE.Seasoned, { expect: { accuracy: 1, ratio: 4 }, tolerance: { accuracy: 0.005, ratio: 1.5 } })
	);

	it('good accuracy results in high SS baseline', () =>
		acc(PROFILE.Good, { expect: { accuracy: 1, ratio: 15 }, tolerance: { accuracy: 0.005, ratio: 1.5 } })
	);

	it('expert accuracy results in top SS baseline', () =>
		acc(PROFILE.Expert, { expect: { accuracy: 1, ratio: 50 }, tolerance: { accuracy: 0.002, ratio: 1.5 } })
	);

	it('pro accuracy results in X baseline', () =>
		acc(PROFILE.Pro, { expect: { accuracy: 1, ratio: 300 }, tolerance: { accuracy: 0, ratio: 1.5 } })
	);
});

describe('global scaling', () => {
	checkMap('6-aiae', {
		[PROFILE.Beginner]: MASTERY.IMPOSSIBLE,
		[PROFILE.Newbie]: MASTERY.IMPOSSIBLE,
		[PROFILE.Casual]: MASTERY.IMPOSSIBLE,
		[PROFILE.Regular]: MASTERY.IMPOSSIBLE,
		[PROFILE.Confirmed]: MASTERY.IMPOSSIBLE,
		[PROFILE.Seasoned]: MASTERY.IMPOSSIBLE,
		[PROFILE.Good]: MASTERY.B,
		[PROFILE.Expert]: MASTERY.HARD_A,
		[PROFILE.Pro]: MASTERY.HIGH_S,
	});
	
	checkMap('6-shaper', {
		[PROFILE.Beginner]: MASTERY.IMPOSSIBLE,
		[PROFILE.Newbie]: MASTERY.IMPOSSIBLE,
		[PROFILE.Casual]: MASTERY.IMPOSSIBLE,
		[PROFILE.Regular]: MASTERY.IMPOSSIBLE,
		[PROFILE.Confirmed]: MASTERY.IMPOSSIBLE,
		[PROFILE.Seasoned]: MASTERY.B,
		[PROFILE.Good]: MASTERY.S,
		[PROFILE.Expert]: MASTERY.HIGH_S,
		[PROFILE.Pro]: MASTERY.LOW_SS,
	});
	
	checkMap('5-c18', {
		[PROFILE.Beginner]: MASTERY.IMPOSSIBLE,
		[PROFILE.Newbie]: MASTERY.IMPOSSIBLE,
		[PROFILE.Casual]: MASTERY.IMPOSSIBLE,
		[PROFILE.Regular]: MASTERY.IMPOSSIBLE,
		[PROFILE.Confirmed]: MASTERY.B,
		[PROFILE.Seasoned]: MASTERY.S,
		[PROFILE.Good]: MASTERY.HIGH_S,
		[PROFILE.Expert]: MASTERY.LOW_SS,
		[PROFILE.Pro]: MASTERY.SS,
	});
	
	checkMap('1-refresh', {
		[PROFILE.Beginner]: MASTERY.B,
		[PROFILE.Newbie]: MASTERY.A,
		[PROFILE.Casual]: MASTERY.LOW_S,
		[PROFILE.Regular]: MASTERY.HIGH_S,
		[PROFILE.Confirmed]: MASTERY.LOW_SS,
		[PROFILE.Seasoned]: MASTERY.SS,
		[PROFILE.Good]: MASTERY.HIGH_SS,
		[PROFILE.Expert]: MASTERY.HIGH_SS,
		[PROFILE.Pro]: MASTERY.X,
	});
	
	checkMap('4.5-tokyo', {
		[PROFILE.Beginner]: MASTERY.IMPOSSIBLE,
		[PROFILE.Newbie]: MASTERY.IMPOSSIBLE,
		[PROFILE.Casual]: MASTERY.IMPOSSIBLE,
		[PROFILE.Regular]: MASTERY.LUCK,
		[PROFILE.Confirmed]: MASTERY.LOW_B,
		[PROFILE.Seasoned]: MASTERY.HIGH_A,
		[PROFILE.Good]: MASTERY.HIGH_S,
		[PROFILE.Expert]: MASTERY.LOW_SS,
		[PROFILE.Pro]: MASTERY.SS,
	});
});
