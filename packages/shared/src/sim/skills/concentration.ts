import type { BotContext } from '../bot.js';
import type {
	Strain,
	SkillStrain,
} from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';

/**
 * Concentration determins both :
 * - The frequency of de-concentration (200ms of stability per level)
 * - The penalty of being de-concentrated
 *
 * Concentration mostly plays a role in high accuracy.
 * At high level, it penalizes the ratio.
 * At very high level, it doesn't cause to drop 300s anymore but it will impact UR.
 *
 * On top of widening the hit cloud (variance), concentration also slowly drifts
 * the timing early/late across the map on a sine wave - the player's internal
 * rhythm swaying ahead of / behind the beat for stretches at a time. Higher
 * level dampens both the variance and the drift.
 *
 * A third metric - endurance - gates both the wobble and the drift by *song
 * duration*: concentration holds steady for a while, then both set in the longer
 * the map runs, and higher level buys more hold time (~30s at low level, ~2min
 * around level 50, ~4min around level 90). It's a bounded gate, not an
 * ever-growing strain.
 */
export default class Concentration extends Skill {

	/** error scale (ms) both the wobble and the drift are expressed against */
	private static readonly MAX = 60;
	/** stability window per level for the variance wobble (ms) */
	private static readonly WOBBLE_MS_PER_LEVEL = 400;
	/** full early→late→early sway cycle, in ms of song time */
	private static readonly DRIFT_PERIOD_MS = 50000;
	/** peak drift (ms) at level 0, before the level dampening */
	private static readonly DRIFT_AMOUNT = Concentration.MAX * 0.4;

	/** how long concentration holds before the drift sets in, at level 0 (ms) */
	private static readonly DRIFT_HOLD_BASE_MS = 25000;
	/** extra hold earned across levels 0..100 (ms) - ~2min of hold by level 90 */
	private static readonly DRIFT_HOLD_SPAN_MS = 140000;
	/** once past the hold, how long the drift takes to ramp in to full (ms) */
	private static readonly DRIFT_RAMP_MS = 80000;

	/** sigma scale of the variance wobble - dampens with level (the "focus") */
	private wobbleFocus!: number;
	/** peak ms of the early/late drift - dampens with level (the "phase") */
	private driftFocus!: number;
	/** song time (ms) at which the drift starts ramping in - grows with level (the "endurance") */
	private driftHoldMs!: number;

	constructor(def = 0) {
		super(SKILL.concentration, def);

		// The wobble (variance) and the drift (directional sway) both steady out
		// as level rises, but along *different* bezier curves - so a player can
		// tighten their spread well before their rhythm stops swaying, or the
		// reverse. They progress asynchronously, like fatigue vs nps in stamina.
		//
		// Wobble keeps a little presence past 100 (two segments), but the drift
		// is a low/mid-level imperfection that fades out entirely: ~3ms at level
		// 90 (barely noticeable) and gone by ~110.
		const wobbleCurve = cubic_bezier(0.3, 0.85, 0.5, 1);
		const driftCurve = cubic_bezier(0.3, 0.4, 0.6, 0.8);
		const wobbleSteadiness = (level: number) =>
			wobbleCurve(Math.min(1, level / 100)) * 0.7 + wobbleCurve(Math.max(0, (level - 100) / 100)) * 0.3;

		// Third metric - endurance: regardless of level, concentration holds for a
		// while before the drift sets in, and *higher level buys more hold time*.
		// This isn't an ever-growing strain; it's a gate that delays when the
		// drift malus starts (it then ramps in over DRIFT_RAMP_MS and plateaus).
		const holdCurve = cubic_bezier(0.4, 0.3, 0.6, 0.7);

		this.level.sync(level => {
			this.wobbleFocus = Math.max(0, 1 - wobbleSteadiness(level));
			this.driftFocus = Math.max(0, 1 - driftCurve(Math.min(1, level / 100)));
			this.driftHoldMs = Concentration.DRIFT_HOLD_BASE_MS
				+ Concentration.DRIFT_HOLD_SPAN_MS * holdCurve(Math.min(1, level / 100));
		});
	}

	analyze(
		note: RuntimeNote,
		_context: BotContext,
		mapStrain: Strain,
		colStrain: Strain,
	): SkillStrain {
		const wobblePhase = note.time / (Math.max(1, this.level.get()) * Concentration.WOBBLE_MS_PER_LEVEL);
		const driftPhase = (note.time / Concentration.DRIFT_PERIOD_MS) * 2 * Math.PI;

		// endurance gate: 0 while concentration still holds, smoothly ramping to 1
		// once the map has run past driftHoldMs (which grows with level)
		const rampEnd = this.driftHoldMs + Concentration.DRIFT_RAMP_MS;
		const r = Math.min(1, Math.max(0, (note.time - this.driftHoldMs) / (rampEnd - this.driftHoldMs)));
		const endurance = r * r * (3 - 2 * r);

		const currentStrain: SkillStrain = {
			note,
			// both the wobble and the drift are held off early in the map and ramp
			// in the longer it runs (endurance), and both dampen with level
			strain: Math.cos(wobblePhase) * this.wobbleFocus * endurance,
			min: 0,
			max: Concentration.MAX,
			type: 'both',
			// directional sway: early on the trough, late on the crest
			bias: Math.sin(driftPhase) * Concentration.DRIFT_AMOUNT * this.driftFocus * endurance,
		};

		colStrain.concentration.push(currentStrain);
		mapStrain.concentration.push(currentStrain);

		return currentStrain;
	}

}
