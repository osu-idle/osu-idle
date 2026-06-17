import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import gaussian from '../../math/gaussian.js';
import lerp from '../../math/lerp.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';
import { mapped, type ValueIn } from '../../helpers/mapped.js';

const HAND = mapped(['LEFT', 'RIGHT']);
export type Hand = ValueIn<typeof HAND>;

export const hand = (column: number, keyCount: number = 4): Hand => {
	return column < keyCount / 2 ? HAND.LEFT : HAND.RIGHT;
};

type Group = {
	time: number,
	notes: RuntimeNote[],
	columns: Map<number, number>,
	left: boolean,
	right: boolean,
	weight?: number,
	manip: boolean
};

const MANIP_START_MS = 20;
const MANIP_END_MS = 80;

/** Probability that a note `gap` ms after a group's anchor is close enough to be
 *  manipped into it. Inside MANIP_START_MS it always merges (a true chord / tight
 *  roll); past MANIP_END_MS never. Between the two the chance ramps down linearly,
 *  so the manip window is a soft probabilistic band rather than a hard cutoff. */
export const manipChance = (gap: number): number => {
	if (gap < MANIP_START_MS) return 1;
	if (gap >= MANIP_END_MS) return 0;
	return 1 - (gap - MANIP_START_MS) / (MANIP_END_MS - MANIP_START_MS);
};

/** Ceiling on the fatigue accumulator. The gaussian sigma is capped at 1, so
 *  the band (1 .. MAX_STRAIN] is pure "overflow" - how badly the player is being
 *  over-capped. Bounded so it can't run away and lock in permanent misses. */
const MAX_STRAIN = 3;

/** Miss probability at full overflow (accumulator pinned at MAX_STRAIN). The
 *  chance scales linearly from 0 (no overflow) up to this. */
const MISS_CHANCE = 0.2;


export default class Speed extends Skill {

	private static fn = cubic_bezier(0,.65,1,.45);
	private enablednps!: number;
	private comfortnps!: number;
	private nps!: number;

	constructor(def = 0) {
		super(SKILL.speed, def);

		this.level.sync(level => {
			const { enablednps, comfortnps, nps } = Speed.computeForLevel(level);
			this.enablednps = enablednps;
			this.comfortnps = comfortnps;
			this.nps = nps;
		});
	}

	public static computeForLevel(level: number) {
		const skill = Speed.fn(Math.min(1, level / 100));
		const bonus = Math.min(100, Math.max(0, level - 100));
		return {
			enablednps: 2 + 5 * skill + bonus * 2,
			comfortnps: 4 + 11 * skill + bonus * 2,
			nps: 3 +  29 * skill + bonus * 4,
		};
	}

	analyze(note: RuntimeNote, context: BotContext, mapStrain: Strain, colStrain: Strain): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: 0,
			min: 0,
			max: 160,
			type: 0.85,
			unpure: 0,
		};

		const previous = mapStrain.speed.length > 0 ? mapStrain.speed[mapStrain.speed.length - 1] : undefined;
		const previousStrain = !previous ? 0 : previous.strain;
		const previousOverflow = previous?.overflow ?? 0;
		const nps = Speed.weightedGroups(this._noteGroup, context.recentNotes(note.time));

		const stable = this.nps * 1.1;
		const burst = this.nps * 1.3;

		let recoup = 0;
		let strain = 0;

		currentStrain.unpure = (previous?.unpure ?? 0) / 2;

		if (nps >= this.enablednps) {
			currentStrain.unpure += 0.05;
		} else {
			currentStrain.unpure -= 0.05;
		}

		if (nps <= this.comfortnps) {
			// RECOVERY PHASE: at or below the comfortable rate - fatigue bleeds off
			// and timing stays clean. Slower NPS recovers faster (30% → 15%).
			const t = this.comfortnps > 0 ? Math.max(0, nps / this.comfortnps) : 0;
			recoup = lerp(0.3, 0.15, t);
			strain = 0;

		} else if (nps <= this.nps) {
			// STRAINING PHASE: past the comfortable rate but short of a burst. Only
			// sustainable briefly - a steady strain input accumulates while recovery
			// weakens, so the *longer* you stay over comfort the more fatigue builds,
			// eventually overflowing the cap into misses.
			const factor = (nps - this.comfortnps) / Math.max(0.001, this.nps - this.comfortnps); // 0..1

			recoup = lerp(0.15, 0.04, factor);
			// a small per-note input that compounds: near comfort it barely builds,
			// near `nps` it climbs to overflow over a few seconds of sustained play
			strain = lerp(0, 0.02, factor);

			// immediate timing widening on top of the building fatigue, scaling with
			// how far past comfort we are
			currentStrain.min = gaussian((8 * factor) * Math.max(1, 8 * factor));
			currentStrain.max = 80 + gaussian((8 * factor) * Math.max(1, 8 * factor));
			currentStrain.type = 0.75;
			currentStrain.centerFactor = 0.5;
			currentStrain.unpure += 0.05;

		} else if (nps < stable) {
			// STABLE PHASE
			const t = (nps - this.nps) / (stable - this.nps);

			// Smoothly drop recovery from 15% down to 5%
			recoup = lerp(0.15, 0.05, t);

			// Strain input scales from 0 to a VERY small number (0.015)
			// to respect the explosive nature of your (0, .8...) Bezier curve.
			strain = lerp(0, 0.015, t);

		} else if (nps < burst) {
			// BURST PHASE
			const t = (nps - stable) / (burst - stable);

			// Recovery drops from 5% down to 1% (compounding effect begins)
			recoup = lerp(0.05, 0.01, t);

			// Base input seamlessly picks up at 0.015 and scales to 0.05.
			// We multiply by (1 + previousStrain) so it ramps naturally without a harsh flat addition.
			const burstBase = lerp(0.015, 0.05, t);
			strain = burstBase * (1 + previousStrain);
			currentStrain.unpure += 0.05;

		} else {
			// TOO HARD PHASE
			// Instead of instantly snapping to 1.0 input, blend it over a 20% margin
			// so over-hitting a burst by 0.1 NPS doesn't instantly kill the player.
			const overcap = Math.min(1, (nps - burst) / (burst * 0.2));

			recoup = lerp(0.01, 0.0, overcap);
			strain = lerp(0.05 * (1 + previousStrain), 1.0, overcap);
			currentStrain.unpure += 0.05;
		}

		// Accumulate fatigue on the *uncapped* previous total (sigma + overflow) so
		// sustained over-capping keeps building past the cap, then bound it.
		const accumulated = Math.min(
			MAX_STRAIN,
			(previousStrain + previousOverflow) * (1 - recoup) + cubic_bezier(0, .8, 1, .5)(strain),
		);

		// The gaussian sigma stays in [0, 1] - its dynamics below the cap are
		// unchanged. The excess lives in a separate `overflow` metric.
		currentStrain.strain = Math.min(1, accumulated);
		currentStrain.overflow = Math.max(0, accumulated - 1);

		// Chance to drop the note scales with how far past the cap we've built, so
		// a brief overshoot is survivable but sustained over-capping forces misses.
		const overflowFactor = currentStrain.overflow / (MAX_STRAIN - 1);
		if (Math.random() < overflowFactor * MISS_CHANCE) {
			currentStrain.miss = true;
		}

		colStrain.speed.push(currentStrain);
		mapStrain.speed.push(currentStrain);

		return currentStrain;
	}

	private _noteGroup = new Map<string, Group>();
	/**
	 * Notes-per-second over the trailing `window`, with simultaneous notes
	 * (chords) weighted above a single tap - a chord is harder than its notes
	 * spread out.
	 */
	public static weightedGroups(cache: Map<string, Group>, recent: RuntimeNote[]): number {
		const groups = recent.reduce((acc, note, i) => {
			const cached = cache.get(note.getId());
			if (cached) {
				acc.set(cached.time, cached);
				return acc;
			}

			const prev = i > 0 ? recent[i - 1] : undefined;
			const prevGroup = prev ? cache.get(prev.getId()) : undefined;
			const left = hand(note.column) === HAND.LEFT;
			if (prevGroup && Math.random() < manipChance(note.time - prevGroup.time)) {
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
				};
				acc.set(note.time, n);
				cache.set(note.getId(), n);
			}
			return acc;
		}, new Map<number, Group>());

		let total = 0;
		for (const [, group] of groups) {
			if (group.weight === undefined) {
				group.weight = group.notes.length;
				group.weight /= (group.left !== group.right) ? 1.75 : 1;
				group.weight /= (group.notes.length === 3 && group.columns.size === 3) ? 1.5 : 1;
				group.weight /= (group.notes.length === 4 && group.columns.size === 4) ? 2 : 1;
				group.weight *= group.manip ? 1.2 : 1;
			}
			total += group.weight;
		}

		return total;
	}

}
