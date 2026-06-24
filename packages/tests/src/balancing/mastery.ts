import { GRADE } from '@osu-idle/shared/judgement';
import {
	Bounds,
	Expectation,
	Tolerance,
} from './harness';

export type Bundle = { expect: Expectation; tolerance?: Tolerance; bounds?: Bounds };

export const MASTERY = {
	/** This player can never clear the map under any circumstances */
	IMPOSSIBLE: {
		expect: { fail: true },
		tolerance: { failRate: 0 },
	},
	/** This player can sometimes clear the map but must fail most of the time */
	LUCK: {
		expect: { fail: true },
		tolerance: { failRate: 0.25 },
	},
	/** Very low accuracy (C or B) with large tolerance but no fail expectations */
	LOW_B: {
		expect: { accuracy: 0.8 },
		tolerance: { accuracy: 0.1 },
	},
	/** Consistent B grade with no failures at all (very bad accuracy) */
	CLEAR_B: {
		expect: {
			accuracy: 0.85, fail: false, 
		},
		tolerance: {
			accuracy: 0.05, failRate: 0, 
		},
	},
	/** Consistent B grade with no fail expectations */
	B: {
		expect: {
			accuracy: 0.85, fail: false, 
		},
		tolerance: {
			accuracy: 0.05, failRate: 1, 
		},
	},
	/** Consistent A grade with a high fail rate (struggle) */
	HARD_A: {
		expect: {
			accuracy: 0.925, fail: true, 
		},
		tolerance: {
			accuracy: 0.025, failRate: 0.50, 
		},
	},
	/** Consistent A grade with a low fail rate */
	A: {
		expect: {
			accuracy: 0.925, fail: false, 
		},
		tolerance: {
			accuracy: 0.025, failRate: 0.50, 
		},
	},
	/** Good A or S rank with a low fail rate */
	HIGH_A: {
		expect: {
			accuracy: 0.94, fail: false, 
		},
		tolerance: {
			accuracy: 0.02, failRate: 0.50, 
		},
	},
	/** Bad S rank, sometimes A and the possibility of failing */
	LOW_S: {
		expect: {
			accuracy: 0.96, fail: false, 
		},
		tolerance: {
			accuracy: 0.015, failRate: 0.25, 
		},
	},
	/** Consistent S grade and the possibility of failing */
	S: {
		expect: {
			accuracy: 0.97, fail: false, 
		},
		tolerance: {
			accuracy: 0.02, failRate: 0.25, 
		},
	},
	/** Great S grade and the possibility of failing */
	HIGH_S: {
		expect: {
			accuracy: 0.9825, fail: false, 
		},
		tolerance: {
			accuracy: 0.0175, failRate: 0.25, 
		},
	},
	/** Very high S grade with the possibility of getting an SS, but with a limited ratio */
	LOW_SS: {
		expect: {
			accuracy: 0.99, ratio: 5, fail: false, 
		},
		bounds: {
			accuracy: 'gte', ratio: 'lte', 
		},
	},
	/** Great chance of SS grade with room for S grades, and a regular / good ratio */
	SS: {
		expect: {
			accuracy: 1, ratio: 6, fail: false, 
		},
		tolerance: {
			accuracy: 0.005, ratio: 2.5, 
		},
	},
	/** Great chance of SS grade with room for S grades, but always with a great ratio */
	HIGH_SS: {
		expect: {
			accuracy: 1, ratio: 10, fail: false, 
		},
		tolerance: { accuracy: 0.005 },
		bounds: { ratio: 'gte' },
	},
	/** Expects the possibility of an X grade on the map (<=10% of the time) */
	X: {
		expect: {
			grade: GRADE.X, fail: false, 
		},
		tolerance: { gradeRate: 0.1 },
	},
} satisfies Record<string, Bundle>;