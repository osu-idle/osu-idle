import { expect } from 'vitest';
import { Grades, type Grade } from '@osu-idle/shared/judgement';
import type { HitRecord } from '@osu-idle/shared/sim/maniaGame';
import type { ScoreState } from '@osu-idle/shared/sim/scoring';
import type { SkillName } from '@osu-idle/shared/skills';
import { loadBeatmap, simulate, analyzeSkill, type SkillSpec } from './sim';
import sum from '@osu-idle/shared/helpers/sum';
import avg from '@osu-idle/shared/math/avg';

/**
 * Scenario harness for "does this skill set perform as expected on this chart?".
 * A scenario targets either the full bot play (`skills`) or one skill in
 * isolation (`skill` + `level`), runs it many times, and checks the *aggregate*
 * against expected metrics within tolerance bands - never equality, because the
 * bot plays stochastically.
 *
 * Entry points:
 *  - {@link aggregate} - run N plays, get the raw stats.
 *  - {@link runScenario} - declare expected metrics + tolerances; prints a
 *    deviation report and fails only when a metric drifts out of band.
 */

/** Full-bot play, or a single skill in isolation. */
export type ScenarioInput =
	| { chart: string; runs?: number; skills: SkillSpec }
	| { chart: string; runs?: number; skill: SkillName; level: number };

/** The result metrics of a single play. */
interface Outcome {
	score: number;
	accuracy: number;
	ratio: number;
	grade: Grade;
	failed: boolean;
	/** song time (ms) at which HP hit 0, or null if the play survived */
	failTime: number | null;
	judged: number;
}

function outcomeOf(score: ScoreState, hits: HitRecord[]): Outcome {
	const failed = score.failed;
	return {
		score: score.score,
		accuracy: score.accuracy,
		ratio: score.counts.MARVELOUS / Math.max(1, sum(Object.values(score.counts)) - score.counts.MARVELOUS),
		grade: score.grade,
		failed,
		// hits is parallel to the judgement sequence, so the failing judgement's
		// note time is the song time the play stopped at (same as server/play.ts).
		failTime: failed ? hits[score.failedIndex - 1].time : null,
		judged: hits.length,
	};
}

function playOnce(input: ScenarioInput, beatmap: ReturnType<typeof loadBeatmap>): Outcome {
	if ('skill' in input) {
		const r = analyzeSkill(beatmap, input.skill, input.level);
		return outcomeOf(r.score, r.hits);
	}
	const game = simulate(beatmap, input.skills);
	return outcomeOf(game.score, game.hits);
}

export interface Aggregate {
	runs: number;
	notes: number;
	scores: number[];
	accuracies: number[];
	meanScore: number;
	scoreStdev: number;
	meanAccuracy: number;
	meanRatio: number;
	accuracyStdev: number;
	ratioStdev: number;
	modalGrade: Grade;
	gradeCounts: Map<Grade, number>;
	failRate: number;
	/** mean failTime over the runs that failed; null if none failed */
	meanFailTime: number | null;
	map: string,
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const stdev = (xs: number[]) => {
	const m = mean(xs);
	return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

/** Run a scenario `runs` times and collect the result metrics. */
export function aggregate(input: ScenarioInput): Aggregate {
	const beatmap = loadBeatmap(`${input.chart}.osu`);
	const runs = input.runs ?? 25;
	const outcomes: Outcome[] = [];
	for (let i = 0; i < runs; i++) outcomes.push(playOnce(input, beatmap));

	const scores = outcomes.map(o => o.score);
	const accuracies = outcomes.map(o => o.accuracy);
	const ratioes = outcomes.map(o => o.ratio);
	const failTimes = outcomes.filter(o => o.failTime != null).map(o => o.failTime!);
	const gradeCounts = new Map<Grade, number>();
	for (const o of outcomes) gradeCounts.set(o.grade, (gradeCounts.get(o.grade) ?? 0) + 1);

	return {
		runs,
		notes: outcomes[0].judged,
		scores,
		accuracies,
		meanScore: mean(scores),
		scoreStdev: stdev(scores),
		meanAccuracy: mean(accuracies),
		meanRatio: mean(ratioes),
		accuracyStdev: stdev(accuracies),
		ratioStdev: stdev(ratioes),
		modalGrade: [...gradeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0],
		gradeCounts,
		failRate: outcomes.filter(o => o.failed).length / runs,
		meanFailTime: failTimes.length ? mean(failTimes) : null,
		map: `${beatmap.metadata.title} [${beatmap.metadata.version}]`
	};
}

/** What a (chart, skill set) pairing is expected to achieve. Omit a field to skip it. */
export interface Expectation {
	score?: number;
	accuracy?: number;
	ratio?: number;
	grade?: Grade;
	/** whether the play is expected to fail (HP→0); checked against the fail rate */
	fail?: boolean;
	/** expected song time (ms) of failure - how soon/late HP hits 0 */
	failTime?: number;
}

/** How far each metric may drift before the test fails. */
export interface Tolerance {
	score?: number;
	accuracy?: number;
	ratio?: number;
	/** allowed grade-tier distance between expected and modal grade (0 = exact).
	 *  Used when {@link gradeRate} is not set. */
	gradeTiers?: number;
	/** minimum fraction of runs (0..1) that must reach the expected grade *or
	 *  better*. When set, the grade check uses this instead of {@link gradeTiers}. */
	gradeRate?: number;
	/** allowed deviation of the fail rate from 0 (expect pass) / 1 (expect fail) */
	failRate?: number;
	/** allowed deviation of the mean fail time (ms) */
	failTime?: number;
}

/** A one-sided pass condition: the metric must clear the expected value from
 *  above (`gte`) or below (`lte`), instead of sitting within a symmetric band.
 *  When set for a metric, it replaces that metric's {@link Tolerance}. */
type Bound = 'gte' | 'lte';
export interface Bounds {
	score?: Bound;
	accuracy?: Bound;
	ratio?: Bound;
	gradeRate?: Bound;
}

export type Scenario = ScenarioInput & { profile: string, goal: string, expect: Expectation; tolerance?: Tolerance; bounds?: Bounds };

const DEFAULT_TOLERANCE: Required<Tolerance> = {
	score: 40_000,
	accuracy: 0.03,
	ratio: 2, // Scale factor (divide / multiply)
	gradeTiers: 0,
	gradeRate: 0.9,
	failRate: 0,
	failTime: 5_000,
};

/** The representative skill level for a scenario: its level for a single-skill
 *  run, else the (mean of the) skill spec. */
function scenarioLevel(scenario: ScenarioInput): number {
	if ('skill' in scenario) return scenario.level;
	return typeof scenario.skills === 'number' ? scenario.skills : avg(...Object.values(scenario.skills));
}

const gradeRank = (g: Grade) => Grades.indexOf(g); // 0 = X (best) … 7 = F
const num = (n: number) => Math.round(n).toLocaleString('en-US');
const pr = (n: number) => `${n.toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
const signed = (n: number, fmt: (n: number) => string) => (n >= 0 ? '+' : '-') + fmt(Math.abs(n));
const scaled = (n: number, fmt: (n: number) => string) => (n >= 1 ? n : (1/n)) + fmt(n);
const pad = (s: string, w: number) => s.padEnd(w);

/** A metric's verdict: did it pass, and the tolerance/bound label to display. */
interface Verdict { ok: boolean; tolStr: string; }

/** Symmetric tolerance band, unless a one-sided bound is given for the metric. */
function band(actual: number, expected: number, tol: number, fmt: (n: number) => string, bound?: Bound): Verdict {
	if (bound === 'gte') return { ok: actual >= expected, tolStr: `≥${fmt(expected)}` };
	if (bound === 'lte') return { ok: actual <= expected, tolStr: `≤${fmt(expected)}` };
	return { ok: Math.abs(actual - expected) <= tol, tolStr: `±${fmt(tol)}` };
}

/** Sink for one report row: renders it and, when the metric failed, records why. */
type Report = (metric: string, expected: string, actual: string, delta: string, verdict: Verdict, problem: string) => void;

/** Standard numeric metric: a symmetric (or one-sided) tolerance band on the
 *  mean, shown next to its stdev. No-op when the scenario doesn't expect it. */
function reportMetric(report: Report, metric: string, expected: number | undefined, mean: number, stdev: number, tol: number, fmt: (n: number) => string, bound?: Bound): void {
	if (expected === undefined) return;
	const d = mean - expected;
	report(metric, fmt(expected), `${fmt(mean)} ±${fmt(stdev)}`, signed(d, fmt),
		band(mean, expected, tol, fmt, bound),
		`${metric} off by ${signed(d, fmt)}`);
}

/** Ratio is multiplicative: the symmetric band is a fold factor, not ±. */
function reportRatio(report: Report, a: Aggregate, exp: Expectation, tol: Required<Tolerance>, bounds: Bounds): void {
	if (exp.ratio === undefined) return;
	const factor = a.meanRatio / Math.max(0.1, exp.ratio);
	const verdict = bounds.ratio
		? band(a.meanRatio, exp.ratio, tol.ratio, pr, bounds.ratio)
		: { ok: factor <= tol.ratio && factor >= 1 / tol.ratio, tolStr: `±${pr(tol.ratio)}` };
	report('ratio', pr(exp.ratio), `${pr(a.meanRatio)} ±${pr(a.ratioStdev)}`, pr(factor), verdict,
		`ratio off by a factor of ${scaled(factor, pr)}`);
}

/** Grade is checked one of two ways: as a hit-rate (reached this grade or better
 *  in ≥X% of runs) when the scenario sets a gradeRate tolerance, else as the
 *  modal grade's distance in tiers from the expected one. */
function reportGrade(report: Report, a: Aggregate, exp: Expectation, tol: Required<Tolerance>, tolerance: Tolerance | undefined, gradeDist: string): void {
	if (exp.grade === undefined) return;
	if (tolerance?.gradeRate !== undefined) {
		// How often the play reaches the expected grade or better (lower rank = better).
		const rate = sum([...a.gradeCounts.entries()]
			.filter(([g]) => gradeRank(g) <= gradeRank(exp.grade!))
			.map(([, n]) => n)) / a.runs;
		report('grade', `≥${exp.grade}`, `${a.modalGrade}  (${gradeDist})`, `${pct(rate)} reached`,
			{ ok: rate >= tol.gradeRate, tolStr: `≥${pct(tol.gradeRate)}` },
			`reached ${exp.grade}+ in ${pct(rate)} of runs (need ≥${pct(tol.gradeRate)})`);
	} else {
		const d = Math.abs(gradeRank(a.modalGrade) - gradeRank(exp.grade));
		report('grade', exp.grade, `${a.modalGrade}  (${gradeDist})`, `${d} tier${d === 1 ? '' : 's'}`,
			{ ok: d <= tol.gradeTiers, tolStr: `≤${tol.gradeTiers}` },
			`modal grade ${a.modalGrade}, expected ${exp.grade} (${d} tiers off)`);
	}
}

/** Whether the play fails as often as expected (a pure pass/fail expectation). */
function reportFail(report: Report, a: Aggregate, exp: Expectation, tol: Required<Tolerance>): void {
	if (exp.fail === undefined) return;
	const d = a.failRate - (exp.fail ? 1 : 0);
	report('fail', exp.fail ? 'fails' : 'passes', `${pct(a.failRate)} failed`, signed(d, pct),
		{ ok: Math.abs(d) <= tol.failRate, tolStr: `±${pct(tol.failRate)}` },
		`fail rate ${pct(a.failRate)}, expected ${exp.fail ? 'fail' : 'pass'}`);
}

/** When the play is expected to fail mid-map, how close the mean fail time lands. */
function reportFailTime(report: Report, a: Aggregate, exp: Expectation, tol: Required<Tolerance>): void {
	if (exp.failTime === undefined) return;
	if (a.meanFailTime === null) {
		report('failTime', secs(exp.failTime), 'never failed', '-',
			{ ok: false, tolStr: `±${secs(tol.failTime)}` },
			`expected failure near ${secs(exp.failTime)} but no run failed`);
		return;
	}
	const d = a.meanFailTime - exp.failTime;
	report('failTime', secs(exp.failTime), `${secs(a.meanFailTime)} (${pct(a.failRate)} of runs)`, signed(d, secs),
		{ ok: Math.abs(d) <= tol.failTime, tolStr: `±${secs(tol.failTime)}` },
		`fail time off by ${signed(d, secs)}`);
}

/**
 * Run a scenario, print its deviation report, and assert every checked metric is
 * within tolerance. Call inside a vitest `it(...)`.
 */
export function runScenario(scenario: Scenario): void {
	const tol = { ...DEFAULT_TOLERANCE, ...scenario.tolerance };
	const bounds = scenario.bounds ?? {};
	const a = aggregate(scenario);
	const exp = scenario.expect;

	const gradeDist = [...a.gradeCounts.entries()]
		.sort((x, y) => y[1] - x[1])
		.map(([g, n]) => `${g} ${Math.round((n / a.runs) * 100)}%`)
		.join(' · ');

	const level = scenarioLevel(scenario);

	const lines: string[] = [
		`\n━━  ${scenario.goal} | ${scenario.profile} (lvl${level}) | ${a.map}`,
		`   ${pad('metric', 10)}${pad('expected', 14)}${pad('actual', 22)}${pad('Δ', 14)}tol`,
	];
	const problems: string[] = [];

	/** Append one report row; record a problem when the metric failed. */
	const report: Report = (metric, expected, actual, delta, { ok, tolStr }, problem) => {
		lines.push(`   ${ok ? '✓' : '✗'} ${pad(metric, 8)}${pad(expected, 14)}${pad(actual, 22)}${pad(delta, 14)}${tolStr}`);
		if (!ok) problems.push(`${problem} (tol ${tolStr})`);
	};

	reportMetric(report, 'score', exp.score, a.meanScore, a.scoreStdev, tol.score, num, bounds.score);
	reportMetric(report, 'accuracy', exp.accuracy, a.meanAccuracy, a.accuracyStdev, tol.accuracy, pct, bounds.accuracy);
	reportRatio(report, a, exp, tol, bounds);
	reportGrade(report, a, exp, tol, scenario.tolerance, gradeDist);
	reportFail(report, a, exp, tol);
	reportFailTime(report, a, exp, tol);

	// Always surface the report - pass or fail - so deviations are visible.
	console.log(lines.join('\n'));
	expect(problems, `'${scenario.goal}' for level ${scenario.profile} not achieved:\n  ${problems.join('\n  ')}\n${lines.join('\n')}`).toEqual([]);
}
