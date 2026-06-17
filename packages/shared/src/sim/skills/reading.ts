import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';
import { mapped, type ValueIn } from '../../helpers/mapped.js';

const HAND = mapped(['LEFT', 'RIGHT']);
type Hand = ValueIn<typeof HAND>;

export const hand = (column: number, keyCount: number = 4): Hand => {
	return column < keyCount / 2 ? HAND.LEFT : HAND.RIGHT;
};

const MANIP_MS = 80;

type Group = {
	time: number,
	notes: RuntimeNote[],
	columns: Map<number, number>,
	left: boolean,
	right: boolean,
	weight?: number,
	manip: boolean,
	/** bitmask of the group's columns (Σ 1<<col) - an alloc-free stand-in for the
	 *  old `sort().join()` string id: same column set ⇒ same mask, keys transitions */
	mask: number,
};

/**
 * 1* -> around 4 transitions max
 * 2* -> around 5/6 transitions max
 * 3* -> around 7/8 transitions max, burst 10
 * 5* -> around 9/10 transitions constant, burst 11
 * 6* -> around 10/11 transitions constant, burst 12
 */

export default class Reading extends Skill {

	private static fn = cubic_bezier(.22,1,.8,.6);
	private notes!: number;
	private above!: number;

	constructor(def = 0) {
		super(SKILL.reading, def);

		this.level.sync(level => {
			const { notes, above } = Reading.computeForLevel(level);
			this.notes = notes;
			this.above = above;
		});
	}

	public static computeForLevel(level: number) {
		const skill = 7 * this.fn(level / 100) + 4 * this.fn(Math.max(0, level - 100) / 10);
		const bonus = Math.min(1, Math.max(0, (level - 90) / 10));
		return {
			notes: 2 + skill + bonus,
			above: 4 + skill + bonus * 2,
		};
	}

	private _noteGroup = new Map<string, Group>();
	private static groups(cache: Map<string, Group>, recent: RuntimeNote[]) {
		const groups = Array.from(recent.reduce((acc, note, i) => {
			const cached = cache.get(note.getId());
			if (cached) {
				acc.set(cached.time, cached);
				return acc;
			}
	
			const prev = i > 0 ? recent[i - 1] : undefined;
			const prevGroup = prev ? cache.get(prev.getId()) : undefined;
			const left = hand(note.column) === HAND.LEFT;
			if (prevGroup && (note.time - prevGroup.time < MANIP_MS)) {
				prevGroup?.notes.push(note);
	
				if (note.time !== prevGroup.time) {
					prevGroup.manip = true;
				}
					
				if (left) {
					prevGroup.left = true;
				} else {
					prevGroup.right = true;
				}
				prevGroup.columns.set(note.column, (prevGroup.columns.get(note.column) ?? 0) + 1);
				cache.set(note.getId(), prevGroup);
			} else {
				const n: Group = {
					columns: new Map([[note.column, 1]]),
					left,
					right: !left,
					notes: [note],
					time: note.time,
					manip: false,
					mask: 0,
				};
				acc.set(note.time, n);
				cache.set(note.getId(), n);
			}
			return acc;
		}, new Map<number, Group>()).values());

		// a group's column set can still grow as later notes are manipped in, so
		// recompute the mask each pass (integer bitwise - no array/sort/string)
		for (const group of groups) {
			let mask = 0;
			for (const col of group.columns.keys()) mask |= 1 << col;
			group.mask = mask;
		}

		return groups;
	}

	public static countTransitions(cache: Map<string, Group>, notes: RuntimeNote[]) {
		const groups = this.groups(cache, notes).sort((a, b) => a.time - b.time);
		const transitions = new Set<number>();
		for (let i = 1; i < groups.length; i++) {
			// pack the ordered (prev, cur) column-mask pair into one int (masks < 2^20)
			transitions.add(groups[i - 1].mask * 0x100000 + groups[i].mask);
		}
		return transitions.size;
	}

	analyze(note: RuntimeNote, context: BotContext, mapStrain: Strain, strain: Strain): SkillStrain {
		const previous = mapStrain.reading.length > 0 ? mapStrain.reading[mapStrain.reading.length - 1] : undefined;
		const previousStrain = !previous ? 0 : previous.strain;

		const notes = context.visibleNotes(note.time - 400);
		const complexity = Reading.countTransitions(this._noteGroup, notes);
		const strainVal = cubic_bezier(.5, 0, .5, 1)((complexity - this.notes) / Math.max(1, this.notes / 8));
		const strainAboveVal = cubic_bezier(.5, 0, .5, 1)((complexity - this.above) / Math.max(1, this.above / 8));

		const next = (previousStrain / 1.15) + (strainVal / 8);

		const currentStrain: SkillStrain = {
			note,
			strain: next,
			miss: next > 0.9 ? (Math.random() > 0.5 ? strainAboveVal > 0.9 : (Math.random() < 0.15)) : false,
			min: 0,
			max: 180,
			type: 'both',
		};

		strain.reading.push(currentStrain);
		mapStrain.reading.push(currentStrain);

		return currentStrain;
	}

}
