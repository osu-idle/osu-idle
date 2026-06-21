import type { BotContext } from '../bot.js';
import { type Strain, type SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import lerp from '../../math/lerp.js';
import Skill from './skill.js';
import { PRESSURE_SKILLS, SKILL } from '../../skills.js';

/**
 * Consistency is the anti-choke skill. With a small, level-shrinking chance,
 * any input can simply go wrong - at every level of play, regardless of how
 * easy the map is or how fresh the player is. A choke is either an *accuracy
 * choke* (a wild but still hittable error) or a *miss choke* (the input is
 * dropped outright), in tunable proportion.
 *
 * It also trains unlike the other skills: being strained by it (choking) is
 * not what earns XP - XP comes from surviving the speed-family pressure of a
 * play cleanly. See the consistency special case in CharacterBot.getSkillsXP.
 */
export default class Consistency extends Skill {

	private static fn = cubic_bezier(.67,.28,0,.75);
	private static fnMiss = cubic_bezier(1,.58,1,.89);
	private static fnPressure = cubic_bezier(1,.58,1,.89);

	/** per-input choke probability at level 0; shrinks to ~nothing by ~110 */
	public static readonly BASE_CHOKE_CHANCE = 0.0015;
	/** choke probability floor at max level */
	public static readonly MIN_CHOKE_CHANCE = 0.00005;
	/** share of chokes that drop the input outright (miss chokes); the rest are
	 *  accuracy chokes. Scales with the pressure the player is under at that
	 *  moment: a choke on an unstraining map is almost always just a flubbed
	 *  hit, one mid-pressure caps at the MAX share of full drops. */
	public static readonly MISS_CHOKE_SHARE_MIN_MIN = 0.01;
	public static readonly MISS_CHOKE_SHARE_MIN_MAX = 0.001;
	public static readonly MISS_CHOKE_SHARE_MAX_MIN = 0.1;
	public static readonly MISS_CHOKE_SHARE_MAX_MAX = 0.01;
	/** accuracy-choke error span (ms): large enough to hurt the ratio, mostly
	 *  inside the windows so it reads as a flubbed hit rather than a miss */
	public static readonly CHOKE_MIN_MS = 25;
	public static readonly CHOKE_MAX_MS = 120;

	private randomness!: number;
	private chokeMin!: number;
	private chokeMax!: number;

	constructor(def = 0) {
		super(SKILL.consistency, def);

		this.level.sync(level => {
			this.randomness = Consistency.BASE_CHOKE_CHANCE
				- Consistency.fn(level / 110) * (Consistency.BASE_CHOKE_CHANCE - Consistency.MIN_CHOKE_CHANCE);

			const chokeLevel = Consistency.fnMiss(level / 110);
			this.chokeMin = lerp(Consistency.MISS_CHOKE_SHARE_MIN_MIN, Consistency.MISS_CHOKE_SHARE_MIN_MAX, chokeLevel);
			this.chokeMax = lerp(Consistency.MISS_CHOKE_SHARE_MAX_MIN, Consistency.MISS_CHOKE_SHARE_MAX_MAX, chokeLevel);
		});
	}

	analyze(note: RuntimeNote, _context: BotContext, mapStrain: Strain, colStrain: Strain): SkillStrain {
		const pressure = Consistency.pressureAt(mapStrain);
		const choke = Math.random() < this.randomness;
		const miss = choke && (Math.random() < lerp(
			this.chokeMin,
			this.chokeMax,
			Consistency.fnPressure(pressure),
		));
		const acc = choke && !miss;

		const currentStrain: SkillStrain = {
			note,
			pressure,
			strain: acc ? 1 : 0,
			// chokes hit presses and releases alike - whichever input this is
			release: acc ? 1 : 0,
			min: acc ? Consistency.CHOKE_MIN_MS : 0,
			max: acc ? Consistency.CHOKE_MAX_MS : 0,
			type: 'both',
			centerFactor: 0.5,
			miss: miss || undefined,
		};

		colStrain.consistency.push(currentStrain);
		mapStrain.consistency.push(currentStrain);

		return currentStrain;
	}

	/** How hard the pressure skills are straining right now, 0..1 - the highest
	 *  of their latest analyzed values. Skills analyzed after consistency in the
	 *  skill order contribute their previous note's value (one input of lag). */
	private static pressureAt(mapStrain: Strain): number {
		let pressure = 0;
		for (const skill of PRESSURE_SKILLS) {
			const series = mapStrain[skill];
			const last = series.length > 0 ? series[series.length - 1] : undefined;
			if (last) pressure = Math.max(pressure, Math.min(1, Math.max(0, last.strain, last.release ?? 0)));
		}
		return pressure;
	}

}
