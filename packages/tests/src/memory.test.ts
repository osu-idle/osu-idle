import {
	describe,
	it,
	expect,
} from 'vitest';
import Memory from '@osu-idle/shared/sim/skills/memory';
import SpeedJam from '@osu-idle/shared/sim/skills/speedjam';
import { newStrain } from '@osu-idle/shared/sim/bots/character';
import type { BotContext } from '@osu-idle/shared/sim/bot';
import type RuntimeNote from '@osu-idle/shared/sim/runtimeNote';

const note = (time: number) => ({ time }) as unknown as RuntimeNote;

/** memory ignores context; speedjam only reads the scroll speed at a time. */
const ctx = (speed: number) => ({ scroll: { getSpeedAt: () => speed } }) as unknown as BotContext;

const reductionAt = (level: number, timesPlayed: number): number => {
	const memory = new Memory(level);
	memory.timesPlayed.set(timesPlayed);
	const map = newStrain();
	const col = newStrain();
	const s = memory.analyze(note(1000), ctx(1), map, col);
	return s.memoryReduction ?? 0;
};

describe('Memory skill reduction', () => {
	it('does nothing on a never-before-played map', () => {
		expect(reductionAt(50, 0)).toBe(0);
	});

	it('grows with times played and saturates within [0, IMPROVE_MAX]', () => {
		const few = reductionAt(50, 5);
		const many = reductionAt(50, 1000);
		expect(many).toBeGreaterThan(few);
		expect(few).toBeGreaterThan(0);
		expect(many).toBeLessThanOrEqual(Memory.IMPROVE_MAX_MAX);
	});

	it('reaches a higher ceiling at higher skill', () => {
		const lowSkill = reductionAt(5, 1000);
		const highSkill = reductionAt(120, 1000);
		expect(highSkill).toBeGreaterThan(lowSkill);
	});
});

describe('SpeedJam consumes the memory reduction', () => {
	// memory (analyzed first) deposits its entry on the shared strain arrays, then
	// speedjam (same note) reads it: it scales its press error by the reduction, and
	// credits memory by the jam strain × the training weight (distinct quantities).
	const jamWith = (reduction: number, train = 0) => {
		const map = newStrain();
		const col = newStrain();
		const n = note(1000);
		// stand in for memory's deposit for this note
		map.memory.push({
			note: n, strain: 0, min: 0, max: 0, type: 'both', memoryReduction: reduction, memoryTrain: train, 
		});
		col.memory.push(map.memory[0]);
		const speedjam = new SpeedJam(50);
		const s = speedjam.analyze(n, ctx(0.5), map, col); // speed != 1 -> a real jam
		return {
			s, memEntry: map.memory[0], 
		};
	};

	it('leaves the jam untouched when there is nothing remembered', () => {
		const full = jamWith(0).s;
		expect(full.strain).toBeGreaterThan(0);
		expect(full.memoryReduction).toBeUndefined();
	});

	it('scales the jam error by the reduction but credits memory by the training weight', () => {
		const full = jamWith(0).s.strain;
		const { s, memEntry } = jamWith(0.5, 0.2);
		expect(s.strain).toBeCloseTo(full * 0.5, 10);      // error shaved by reduction
		expect(memEntry.memoryCredit).toBeCloseTo(full * 0.2, 10); // credit by training weight
	});
});

describe('Memory training weight is a learning hump', () => {
	const trainAt = (level: number, timesPlayed: number): number => {
		const memory = new Memory(level);
		memory.timesPlayed.set(timesPlayed);
		const s = memory.analyze(note(1000), ctx(1), newStrain(), newStrain());
		return s.memoryTrain ?? 0;
	};

	it('is zero on a fresh map and positive while learning', () => {
		expect(trainAt(50, 0)).toBe(0);
		expect(trainAt(50, 10)).toBeGreaterThan(0);
	});

	it('peaks mid-recall, then tapers as the map gets mastered', () => {
		const mid = trainAt(50, 12);
		const mastered = trainAt(50, 5000);
		expect(mid).toBeGreaterThan(mastered);
		expect(mastered).toBeLessThan(0.05); // m -> 1, hump m*(1-m) -> 0
	});
});
