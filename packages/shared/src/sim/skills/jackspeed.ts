import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import lerp from '../../math/lerp.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';
import { manipChance } from './speed.js';
import transpose from '../../math/transpose.js';

/** One hand's last press: the strain entry carrying the running late debt and
 *  the group anchor (chord/manip notes merge into a single press). */
type HandAction = { entry: SkillStrain, anchor: RuntimeNote };

/** In the nps..max band the hand drifts late; chance per press that the player
 *  snaps back on time instead of drifting further. */
const RECOVERY_CHANCE_MIN = 0.01;
const RECOVERY_CHANCE_MAX = 0.15;
const MAX_RECOVERY_CHANCE_MIN = 0.01;
const MAX_RECOVERY_CHANCE_MAX = 0.15;

/** Per-press drift at the top of the nps..max band, as a fraction of the
 *  hand's minimum press interval. */
const DRIFT_FACTOR = 0.5;

/**
 * JackSpeed is how fast one hand can re-press. Same-hand notes are grouped
 * into presses (chords/manip merge, mirroring Speed's groups) and each hand is
 * strained independently on the gap between its own presses.
 *
 * Three caps, in presses per second per hand:
 *  - `comfort`: below it the hand is fresh - no strain at all.
 *  - `nps`: comfort..nps is hittable cleanly but dirties accuracy (unpure).
 *  - `max`: nps..max the presses drift late, sometimes recovering; past `max`
 *    the hand physically can't keep up - each press is delayed by the full
 *    deficit and the lateness compounds into `lateFloor`, a hard minimum on
 *    how early the press can land (enforced across all skills by the bot).
 */
export default class JackSpeed extends Skill {

	private static fn = cubic_bezier(.08,.87,.97,.69);

	private comfort!: number;
	private nps!: number;
	private max!: number;

	private recovery_min!: number;
	private recovery_max!: number;

	/** Per-play (keyed on the bot's map strain) last press of each finger. */
	private fingers = new WeakMap<Strain, Partial<Record<number, HandAction>>>();

	constructor(def = 0) {
		super(SKILL.jackspeed, def);

		this.level.sync(level => {
			const { base, comfort, nps, max } = JackSpeed.computeForLevel(level);
			this.comfort = comfort;
			this.nps = nps;
			this.max = max;

			this.recovery_min = transpose(base, [0, 1], [RECOVERY_CHANCE_MIN, RECOVERY_CHANCE_MAX]);
			this.recovery_max = transpose(base, [0, 1], [MAX_RECOVERY_CHANCE_MIN, MAX_RECOVERY_CHANCE_MAX]);
		});
	}

	public static computeForLevel(level: number) {
		const base = JackSpeed.fn(Math.min(1, level / 100));
		const bonus = JackSpeed.fn(Math.max(0, (level - 100) / 100));

		const comfort = 2 + 6 * base + 8 * bonus;
		const nps = comfort + 1 + 2 * base;
		
		return {
			base,
			comfort,
			nps,
			max: nps + 1 + 2 * base,
		};
	}

	analyze(note: RuntimeNote, _context: BotContext, mapStrain: Strain, colStrain: Strain): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: 0,
			min: 0,
			max: 80,
			type: 0.8,
			unpure: 0,
		};

		const fingers = this.fingers.get(mapStrain) ?? {};
		this.fingers.set(mapStrain, fingers);

		const finger = note.column;
		const action = fingers[finger];
		const maxInterval = 1000 / this.max;

		if (action && Math.random() < manipChance(note.time - action.anchor.time)) {
			// merged into the previous press (chord/manip): the hand hits once, so
			// this note shares that press's timing debt instead of jacking on it
			currentStrain.strain = action.entry.strain;
			currentStrain.unpure = action.entry.unpure;
			currentStrain.bias = action.entry.bias;
			currentStrain.lateFloor = action.entry.lateFloor;
			currentStrain.type = action.entry.type;
		} else {
			this.jack(currentStrain, action, note, maxInterval);
			fingers[finger] = { entry: currentStrain, anchor: note };
		}

		colStrain.jackspeed.push(currentStrain);
		mapStrain.jackspeed.push(currentStrain);

		return currentStrain;
	}

	/** Strain this press as a jack on its finger: dirty accuracy in the comfort..nps
	 *  band, drift late in nps..max, and carry compounding late debt past max. */
	private jack(currentStrain: SkillStrain, action: HandAction | undefined, note: RuntimeNote, maxInterval: number) {
		const previous = action?.entry;
		currentStrain.unpure = (previous?.unpure ?? 0) / 2;

		const gap = action ? note.time - action.anchor.time : Infinity;
		const speed = 1000 / gap;

		// late debt carried over: the hand can't re-press within maxInterval,
		// and lateness it already had pushes that further - slack in the gap
		// drains it back down
		let debt = Math.max(0, (previous?.lateFloor ?? 0) + maxInterval - gap);

		if (speed <= this.comfort) {
			// fresh: nothing to do, unpure decays
		} else if (speed <= this.nps) {
			// hittable cleanly, but accuracy gets dirtied
			const t = (speed - this.comfort) / (this.nps - this.comfort);
			currentStrain.unpure += lerp(0, 0.01, t);
		} else if (speed <= this.max) {
			// drifting: each press lands a bit late unless the player recovers
			const t = (speed - this.nps) / (this.max - this.nps);
			currentStrain.strain = lerp(0.1, 0.4, t);
			if (Math.random() >= this.recovery_min) {
				currentStrain.unpure += lerp(0.01, 0.05, t);
				debt += t * DRIFT_FACTOR * maxInterval;
			}
		} else {
			// over the physical cap: the press is late by the full deficit
			// (already in `debt`) and it compounds press over press
			currentStrain.unpure += 0.075;
			currentStrain.strain = Math.min(1, debt / maxInterval);

			if (Math.random() <= this.recovery_max) {
				debt = 0;
			}
		}

		if (debt > 0) {
			currentStrain.lateFloor = debt;
			currentStrain.bias = debt;
			currentStrain.type = 'both';
		}
	}
}
