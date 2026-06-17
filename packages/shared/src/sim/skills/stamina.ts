import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import max from '../../helpers/max.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';

/**
 * Stamina fatigues the player as the busiest column's nps stays above their
 * comfortable rate, and recovers when it drops below.
 *
 * Strain relaxes toward a target equilibrium set by how far the busiest column
 * overshoots the comfortable rate. The target is gentle just over the comfort
 * line then walls up to 1 (unplayable) by OVERLOAD_WALL overshoot, so:
 *  - at level, the map sits at/under the comfort line and is fine;
 *  - a tier under, strain settles mid-range - harsh but playable;
 *  - two tiers under, the target hits 1 - effectively impossible.
 * The gradual relaxation keeps adjacent levels a smooth step apart (no
 * make-or-break single-level cliff) while still gating hard on being underlevelled.
 */
export default class Stamina extends Skill {

	private static fn = cubic_bezier(.44,.66,.9,.4);

	private recoveryRate!: number;
	private fatigueRate!: number;
	private nps!: number;

	/** fractional overshoot of comfortable nps at which the map becomes
	 *  unplayable (strain settles at 1) - small, so falling under level bites hard */
	private static readonly OVERLOAD_WALL = 0.2;
	/** shape of the climb to that wall: >1 stays gentle just over the comfort
	 *  line (a tier under = harsh but playable) then steepens into the wall
	 *  (two tiers under = impossible) */
	private static readonly OVERLOAD_CURVE = 1.6;

	constructor(def = 0) {
		super(SKILL.stamina, def);

		this.level.sync(level => {
			const { recoveryRate, fatigueRate, nps } = Stamina.computeForLevel(level);
			this.nps = nps;
			this.fatigueRate = fatigueRate;
			this.recoveryRate = recoveryRate;
		});
	}

	public static computeForLevel(level: number) {
		const progress = Stamina.fn(Math.min(1, level / 100));
		const bonusProgress = Math.min(100, Math.max(0, level - 100));

		const nps = 6.6 * progress;
		const bonusNps = 0.6 * bonusProgress;

		const recoveryRate = 0.025 + 0.015 * progress + 0.0015 * bonusProgress;
		const fatigueRate = 0.055 - recoveryRate;

		return {
			nps: 1.2 + nps + bonusNps,
			recoveryRate,
			fatigueRate,
		};
	}

	analyze(note: RuntimeNote, context: BotContext, mapStrain: Strain, strain: Strain): SkillStrain {
		const latest = mapStrain.stamina.length > 0 ? mapStrain.stamina[mapStrain.stamina.length - 1] : undefined;

		const currentStrain: SkillStrain = {
			note,
			strain: latest?.strain ?? 0,
			min: 0,
			max: 160,
			type: 0.9,
			unpure: 0,
		};

		strain.stamina.push(currentStrain);
		mapStrain.stamina.push(currentStrain);

		const elapsed = latest ? note.time - latest.note.time : 0;
		if (!elapsed) return currentStrain;
		
		const previous = mapStrain.stamina.length > 0 ? mapStrain.stamina[mapStrain.stamina.length - 1] : undefined;
		currentStrain.unpure = (previous?.unpure ?? 0) / 2;

		const nps = max([0, 1, 2, 3].map(k => context.npsAt(note.time, undefined, k)));

		// how far the busiest column overshoots the comfortable rate (0 = at/below)
		const overload = Math.max(0, (nps - this.nps) / this.nps);

		// strain we'd settle at under this sustained load. Gentle just over the
		// comfort line then walling up to 1 (unplayable) by OVERLOAD_WALL overshoot,
		// so being under-levelled goes harsh → impossible across a couple of tiers
		// rather than being a mild, always-survivable nerf.
		const target = Math.pow(overload / Stamina.OVERLOAD_WALL, Stamina.OVERLOAD_CURVE);

		// relax toward the target: build at the fatigue rate, recover at the
		// recovery rate. Equilibrium is the target itself (can reach 1), and the
		// gradual approach keeps adjacent levels a smooth step apart, not all-or-nothing.
		const rate = target > currentStrain.strain ? this.fatigueRate : this.recoveryRate;
		currentStrain.strain += (target - currentStrain.strain) * (1 - Math.exp(-rate * (elapsed / 1000)));
		
		currentStrain.unpure += currentStrain.strain / 10;

		if (currentStrain.strain > 0.9) {
			currentStrain.miss = currentStrain.strain === 1 ? Math.random() > 0.5 : Math.random() > 0.9;
			currentStrain.unpure += currentStrain.strain / 10;
		}

		return currentStrain;
	}

}
