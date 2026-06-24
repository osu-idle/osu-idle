import { expect } from 'vitest';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import {
	simulateXP,
	type SkillSpec,
} from '../sim';
import { getBeatmap } from './charts';
import {
	LEVEL,
	type Profile,
} from './experience';

/**
 * Scenario harness for "how much skill XP does this profile earn on this chart?".
 * A scenario plays a chart many times at a profile's skill levels and checks the
 * *mean* XP of named skills against expectations - never equality, since the bot
 * plays stochastically. XP spans orders of magnitude across profiles, so the
 * default tolerance is a multiplicative fold factor, not a ± band (a per-skill
 * absolute band can be given for skills that should earn ~0).
 *
 * Mirrors {@link runScenario} in harness.ts but for the XP pipeline
 * (`bot.getSkillsXP`, server/play.ts) instead of the score.
 */

type XP = Record<SkillName, number>;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdev = (xs: number[]) => {
	const m = mean(xs);
	return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

/** A checkable XP row: a skill, or `total` (the summed XP across all skills). */
export type XPKey = SkillName | 'total';

export interface XPAggregate {
	runs: number;
	map: string;
	meanXP: XP;
	stdevXP: XP;
	/** mean and stdev of the per-play total XP (sum of all skills) */
	meanTotal: number;
	stdevTotal: number;
	meanAccuracy: number;
	failRate: number;
}

/** Play `chart` `runs` times at `spec` and collect the per-skill XP. A failed play
 *  earns 0 XP and is not what we balance for, so only the passing runs feed the
 *  mean - unless every run failed, in which case the XP is genuinely 0. */
export function aggregateXP(
	chart: number, 
	spec: SkillSpec,
	runs: number,
	fatigue = 1,
): XPAggregate {
	const beatmap = getBeatmap(chart);
	const records: XP[] = [];
	const accuracies: number[] = [];
	let failed = 0;
	for (let i = 0; i < runs; i++) {
		const { xp, score } = simulateXP(beatmap, spec, fatigue);
		accuracies.push(score.accuracy);
		if (score.failed) failed++;
		else records.push(xp);
	}

	const meanXP = {} as XP;
	const stdevXP = {} as XP;
	for (const name of Skills) {
		const xs = records.map(r => r[name]);
		meanXP[name] = xs.length ? mean(xs) : 0;
		stdevXP[name] = xs.length ? stdev(xs) : 0;
	}
	const totals = records.map(r => Skills.reduce((s, n) => s + r[n], 0));

	return {
		runs,
		map: `${beatmap.metadata.title} [${beatmap.metadata.version}]`,
		meanXP,
		stdevXP,
		meanTotal: totals.length ? mean(totals) : 0,
		stdevTotal: totals.length ? stdev(totals) : 0,
		meanAccuracy: mean(accuracies),
		failRate: failed / runs,
	};
}

/** Expected mean XP per row (each skill, or `total`). Omit a row to skip it. */
export type XPExpectation = Partial<Record<XPKey, number>>;

/** A skill's pass condition. The two bounds are complementary - the mean passes
 *  if it sits within *either*: a multiplicative fold `factor` (actual within ×n
 *  of expected) OR an absolute ± `band` of XP. The band keeps small expectations,
 *  where a fold factor is meaninglessly tight, from failing on noise. Works as the
 *  global default or a per-skill override; each bound defaults independently. */
export type XPTolerance = { factor?: number; band?: number };

/** Defaults filled in for any bound a scenario leaves unset. */
const DEFAULT_TOLERANCE: Required<XPTolerance> = {
	factor: 1.5, band: 50, 
};

export interface XPScenario {
	profile: Profile;
	chart: number;
	goal?: string;
	/** baseline level for every skill (defaults to the profile's level) */
	base?: number;
	/** per-skill level overrides layered on top of {@link base} */
	levels?: Partial<XP>;
	runs?: number;
	/** session fatigue multiplier (1 = fresh) */
	fatigue?: number;
	expect: XPExpectation;
	/** default tolerance for every checked skill (default ×1.5 fold) */
	tolerance?: XPTolerance;
	/** per-row tolerance override (per skill, or for `total`) */
	perSkill?: Partial<Record<XPKey, XPTolerance>>;
}

const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pad = (s: string, w: number) => s.padEnd(w);

/** Judge one skill's mean XP against its (default-filled) tolerance and format the
 *  report cells. Passes if the mean is within the fold factor OR the absolute band. */
const verdict = (
	expected: number,
	actual: number, 
	tol: XPTolerance,
): {
	ok: boolean;
	tolStr: string;
	delta: string 
} => {
	const { factor: f, band: b } = {
		...DEFAULT_TOLERANCE, ...tol, 
	};
	const factor = actual / Math.max(0.1, expected);
	const withinFactor = factor <= f && factor >= 1 / f;
	const withinBand = Math.abs(actual - expected) <= b;
	return {
		ok: withinFactor || withinBand,
		tolStr: `×${f}/±${num(b)}`,
		delta: `×${factor.toFixed(2)}`,
	};
};

/**
 * Run an XP scenario, print its deviation report, and assert every named skill's
 * mean XP is within tolerance. Call inside a vitest `it(...)`.
 */
export function runXPScenario(scenario: XPScenario): void {
	const base = scenario.base ?? LEVEL[scenario.profile];
	const spec = Object.fromEntries(Skills.map(n => [n, scenario.levels?.[n] ?? base])) as XP;
	const runs = scenario.runs ?? 25;
	const a = aggregateXP(scenario.chart, spec, runs, scenario.fatigue ?? 1);
	const goal = scenario.goal ?? 'XP gains';

	const overrides = Object.entries(scenario.levels ?? {}).map(([n, lvl]) => ` ${n} ${lvl}`).join('');
	const lines: string[] = [
		`\n━━  ${goal} | ${scenario.profile} (lvl${base}${overrides}) | ${a.map}`,
		`   acc ${(a.meanAccuracy * 100).toFixed(2)}%  fail ${(a.failRate * 100).toFixed(0)}%`,
		`   ${pad('skill', 14)}${pad('expected', 14)}${pad('actual', 20)}${pad('Δ', 12)}tol`,
	];
	const problems: string[] = [];

	for (const name of [...Skills, 'total'] as XPKey[]) {
		const expected = scenario.expect[name];
		if (expected === undefined) continue;
		const actual = name === 'total' ? a.meanTotal : a.meanXP[name];
		const stdev = name === 'total' ? a.stdevTotal : a.stdevXP[name];
		const tol = {
			...scenario.tolerance, ...scenario.perSkill?.[name], 
		};
		const { ok, tolStr, delta } = verdict(expected, actual, tol);
		lines.push(
			`   ${ok ? '✓' : '✗'} ${pad(name, 14)}${pad(num(expected), 14)}${pad(`${num(actual)} ±${num(stdev)}`
				, 20)}${pad(delta, 12)}${tolStr}`);
		if (!ok) problems.push(
			`${name} XP ${num(actual)}, expected ${num(expected)} (${delta}, tol ${tolStr})`,
		);
	}

	console.log(lines.join('\n'));
	expect(problems, 
		`'${goal}' for ${scenario.profile} not achieved:\n  ${problems.join('\n  ')}\n${lines.join('\n')}`,
	).toEqual([]);
}
