import { describe, it, expect } from 'vitest';
import { skillProfiler } from '@osu-idle/shared/sim/profiler';
import { CHARTS, loadBeatmap, simulate, uniform } from './sim';

/**
 * Score-generation benchmark - its own suite, excluded from `npm test` (run with
 * `npm run benchmark`). It times the authoritative sim path the server takes in
 * `startPlay`: build the bot, run `analyzeContext`, play every note, judge the
 * score. One `simulate()` call == one full server-side score generation.
 *
 * It is a benchmark, not a regression gate: it prints per-chart timings and only
 * asserts that every chart still produces a valid, finite play (so a broken sim
 * fails loudly without making the suite flaky on raw wall-clock numbers).
 */

/** Discarded JIT-warmup runs, then measured runs, per chart. */
const WARMUP = 3;
const RUNS = 10;
/** Runs for the profiled pass - only the relative per-skill split matters here. */
const PROFILE_RUNS = 8;
/** Uniform skill level for the playing bot (every skill analyzes regardless). */
const LEVEL = 50;

const charts = Object.entries(CHARTS).sort(([a], [b]) => a.localeCompare(b));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const percentile = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

interface Row {
	chart: string;
	notes: number;
	meanMs: number;
	medianMs: number;
	minMs: number;
	p95Ms: number;
	notesPerSec: number;
}

const pad = (s: string, w: number) => s.padEnd(w);
const padl = (s: string, w: number) => s.padStart(w);
const ms = (n: number) => n.toFixed(3);
const int = (n: number) => Math.round(n).toLocaleString('en-US');

describe('score generation benchmark', () => {
	it('times full bot score generation across all fixture charts', async () => {
		const skills = uniform(LEVEL);
		const rows: Row[] = [];

		// This benchmark is heavy and fully synchronous; without yielding, the worker
		// event loop is blocked for the whole run and vitest's RPC heartbeat
		// (onTaskUpdate) times out, failing the suite. Yield a macrotask between
		// charts so the worker can service that RPC. (Does not affect the timings -
		// each chart's runs are still measured back-to-back, uninterrupted.)
		const breathe = () => new Promise(resolve => setTimeout(resolve));

		// Pass 1 - clean wall-clock timing, profiler OFF (its `performance.now()`
		// per skill per note would otherwise inflate these headline numbers).
		for (const [name, id] of charts) {
			const beatmap = await loadBeatmap(id);
			for (let i = 0; i < WARMUP; i++) { simulate(beatmap, skills); await breathe(); }

			const times: number[] = [];
			let notes = 0;
			for (let i = 0; i < RUNS; i++) {
				const t0 = performance.now();
				const game = simulate(beatmap, skills);
				times.push(performance.now() - t0);
				notes = game.hits.length;
				await breathe(); // between runs (outside the timed region) so no single sim chains into a long block
			}

			const meanMs = mean(times);
			rows.push({
				chart: name,
				notes,
				meanMs,
				medianMs: percentile(times, 0.5),
				minMs: Math.min(...times),
				p95Ms: percentile(times, 0.95),
				notesPerSec: (notes / meanMs) * 1000,
			});

			// correctness smoke check - a real, finite play, never zero notes
			expect(notes, `${name} produced no judged notes`).toBeGreaterThan(0);
			expect(Number.isFinite(meanMs), `${name} timing not finite`).toBe(true);
			await breathe();
		}

		// Pass 2 - profiled, fewer runs: only the *relative* per-skill split matters.
		skillProfiler.reset();
		skillProfiler.enable();
		for (const [, id] of charts) {
			const beatmap = await loadBeatmap(id);
			for (let i = 0; i < PROFILE_RUNS; i++) { simulate(beatmap, skills); await breathe(); }
		}
		skillProfiler.disable();

		// slowest first - the charts worth optimising sit at the top
		rows.sort((a, b) => b.meanMs - a.meanMs);

		const cell = (n: number) => padl(ms(n) + 'ms', 12);
		const head = `   ${pad('chart', 26)}${padl('notes', 8)}${padl('mean', 12)}${padl('median', 12)}${padl('min', 12)}${padl('p95', 12)}${padl('knotes/s', 11)}`;
		const lines = [`\n━━  score generation · ${RUNS} runs/chart · uniform lvl${LEVEL} · ${charts.length} charts`, head];
		for (const r of rows) {
			lines.push(`   ${pad(r.chart, 26)}${padl(int(r.notes), 8)}${cell(r.meanMs)}${cell(r.medianMs)}${cell(r.minMs)}${cell(r.p95Ms)}${padl((r.notesPerSec / 1000).toFixed(1), 11)}`);
		}

		const totalNotes = rows.reduce((s, r) => s + r.notes, 0);
		const totalMean = rows.reduce((s, r) => s + r.meanMs, 0);
		lines.push(
			`   ${'─'.repeat(78)}`,
			`   ${pad('TOTAL / mean', 26)}${padl(int(totalNotes), 8)}${cell(totalMean)} (sum)   per-score avg ${ms(totalMean / rows.length)}ms`,
			`   throughput ${((totalNotes / totalMean) * 1000 / 1000).toFixed(1)} knotes/s · slowest ${rows[0].chart} (${ms(rows[0].meanMs)}ms) · fastest ${rows[rows.length - 1].chart} (${ms(rows[rows.length - 1].meanMs)}ms)`,
		);

		// per-skill analyze breakdown (slowest first) - which skills cost the most.
		// Reported as µs/note so the profiled pass (PROFILE_RUNS) compares cleanly
		// against the timing pass (RUNS) despite the different run counts.
		const timings = skillProfiler.snapshot();
		const profNotes = timings[0]?.calls ?? 1; // every skill analyzes every note
		const skillTotal = timings.reduce((s, t) => s + t.totalMs, 0);
		const analyzeUsPerNote = (skillTotal / profNotes) * 1000;
		const simUsPerNote = (totalMean / totalNotes) * 1000; // clean (pass 1)
		const us = (n: number) => padl(n.toFixed(2), 11);
		lines.push(
			`\n━━  per-skill analyze time · ${PROFILE_RUNS} profiled runs/chart · ${int(profNotes)} notes`,
			`   ${pad('skill', 16)}${padl('total', 12)}${padl('share', 9)}${padl('µs/note', 11)}`,
		);
		for (const t of timings) {
			lines.push(`   ${pad(t.skill, 16)}${cell(t.totalMs)}${padl(((t.totalMs / skillTotal) * 100).toFixed(1) + '%', 9)}${us((t.totalMs / t.calls) * 1000)}`);
		}
		lines.push(
			`   ${'─'.repeat(48)}`,
			`   ${pad('analyze', 16)}${cell(skillTotal)}${padl('100%', 9)}${us(analyzeUsPerNote)}`,
			`   analyze is ${analyzeUsPerNote.toFixed(2)}µs of the ${simUsPerNote.toFixed(2)}µs/note sim (${((analyzeUsPerNote / simUsPerNote) * 100).toFixed(0)}%); the rest is judging`,
		);
		console.log(lines.join('\n'));
	});
});
