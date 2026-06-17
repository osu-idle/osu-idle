import type { SkillName } from '../skills.js';

/**
 * Opt-in per-skill timing for the benchmark suite. It is **off by default and
 * never enabled in production** - the hot analysis loop only pays a single
 * boolean check when disabled (no `performance.now()` calls, no map writes).
 * The benchmark enables it, runs the sim, then reads {@link snapshot}.
 */

let enabled = false;
const totalMs = new Map<SkillName, number>();
const calls = new Map<SkillName, number>();

export interface SkillTiming {
	skill: SkillName;
	totalMs: number;
	calls: number;
}

export const skillProfiler = {
	get enabled() {
		return enabled;
	},
	enable() {
		enabled = true;
	},
	disable() {
		enabled = false;
	},
	reset() {
		totalMs.clear();
		calls.clear();
	},
	/** Record one `analyze` call's duration. Only called when enabled. */
	add(skill: SkillName, ms: number) {
		totalMs.set(skill, (totalMs.get(skill) ?? 0) + ms);
		calls.set(skill, (calls.get(skill) ?? 0) + 1);
	},
	/** Per-skill totals, slowest first. */
	snapshot(): SkillTiming[] {
		return [...totalMs.entries()]
			.map(([skill, ms]) => ({ skill, totalMs: ms, calls: calls.get(skill) ?? 0 }))
			.sort((a, b) => b.totalMs - a.totalMs);
	},
};
