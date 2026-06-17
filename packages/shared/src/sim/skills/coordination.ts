import { SKILL } from '../../skills.js';
import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import lerp from '../../math/lerp.js';
import Skill from './skill.js';
import { hand } from './speed.js';

type ActiveHold = {
	note: RuntimeNote,
	strain: SkillStrain,
};

/**
 * Coordination models the difficulty of doing two things at once: keeping long
 * notes pinned down while still hitting everything else.
 *
 * Holds are tracked as the analysis walks the map (notes arrive in time order,
 * so the set of LNs held under any note is known ahead of play). Every press
 * made while at least one LN is *already* held builds strain; how much depends
 * on how many LNs are held (HELD_MULT) and on whether the press shares a hand
 * with a held LN (SAME_HAND_MULT, hands hardcoded as 4K halves). Merely holding
 * a single LN costs nothing, and an LN whose end lands exactly on the next note
 * is a transition (LN → note, LN → LN), not a held LN.
 *
 * Strain decays exponentially with elapsed song time - silence recovers it -
 * and while it is up it widens the hit cloud of presses AND releases alike
 * (most skills degrade only one of the two). At max strain each press risks a
 * coordination error: either a held LN is fumble-released right as the new key
 * goes down, or the new note simply isn't pressed.
 */
export default class Coordination extends Skill {

	/** strain gained per pressed note while ≥1 LN is held, before the
	 *  multipliers - the main testing knob (level 0 → level 100+) */
	public static readonly GAIN_BASE = 0.33;
	public static readonly GAIN_SKILLED = 0.03;
	/** per-second exponential strain decay (level 0 → level 100+) - runs on
	 *  elapsed song time, so silence between notes recovers too */
	public static readonly DECAY_BASE = 0.16;
	public static readonly DECAY_SKILLED = 1.1;
	/** gain multiplier indexed by how many LNs are held. Four held means both
	 *  hands are fully busy (4K) - there is nothing left to press, so no strain */
	public static readonly HELD_MULT = [0, 1, 1.25, 1.1, 0];
	/** extra gain when the press shares a hand with a held LN (4K: two columns
	 *  per hand) - combined with HELD_MULT multiplicatively */
	public static readonly SAME_HAND_MULT = 1.1;
	/** test toggle: fold the same-hand bonus in additively instead */
	public static readonly SAME_HAND_ADDITIVE = false;
	/** chance, per press made at max strain, of a coordination error */
	public static readonly ERROR_CHANCE = 0.1;
	/** share of those errors that fumble-release a held LN; the rest ignore the
	 *  pressed note instead */
	public static readonly FUMBLE_SHARE = 0.5;
	/** widest timing error (ms) at full strain */
	public static readonly MAX_ERROR_MS = 160;

	private fatigueRate!: number;
	private decayRate!: number;

	/** LNs currently held (head analyzed, end not reached), with their strain
	 *  entry so a later error can fumble-release them */
	private active: ActiveHold[] = [];

	constructor(def = 0) {
		super(SKILL.coordination, def);

		const fn = cubic_bezier(.15,1,1,.86);
		this.level.sync(level => {
			const p = fn(Math.min(1, level / 100));
			this.fatigueRate = lerp(Coordination.GAIN_BASE, Coordination.GAIN_SKILLED, p);
			this.decayRate = lerp(Coordination.DECAY_BASE, Coordination.DECAY_SKILLED, p);
		});
	}

	analyze(note: RuntimeNote, _context: BotContext, mapStrain: Strain, colStrain: Strain): SkillStrain {
		const previous = mapStrain.coordination.length > 0 ? mapStrain.coordination[mapStrain.coordination.length - 1] : undefined;

		const currentStrain: SkillStrain = {
			note,
			strain: previous?.strain ?? 0,
			min: 0,
			max: Coordination.MAX_ERROR_MS,
			type: 'both',
		};
		// LN heads get a slot a later error can write into - nested so the write
		// survives the copy analyzeContext makes of each skill result
		if (note.hold) currentStrain.forcedRelease = {};

		colStrain.coordination.push(currentStrain);
		mapStrain.coordination.push(currentStrain);

		const elapsed = previous ? note.time - previous.note.time : 0;
		if (elapsed > 0) currentStrain.strain *= Math.exp(-this.decayRate * (elapsed / 1000));

		// drop holds that were fumble-released or have ended. An LN whose end lands
		// exactly on this note is a transition (LN → note / LN → LN), not a held
		// LN - hence the strict >.
		this.active = this.active.filter(h => h.strain.forcedRelease?.at === undefined && h.note.endTime > note.time);

		// already held = pressed strictly before this note; an LN head sharing this
		// note's chord is being pressed *with* it, not held under it
		const held = this.active.filter(h => h.note.time < note.time);

		if (held.length > 0) {
			const heldMult = Coordination.HELD_MULT[Math.min(held.length, Coordination.HELD_MULT.length - 1)];
			const handMult = held.some(h => hand(h.note.column) === hand(note.column)) ? Coordination.SAME_HAND_MULT : 1;
			const mult = Coordination.SAME_HAND_ADDITIVE ? heldMult + (handMult - 1) : heldMult * handMult;
			currentStrain.strain = Math.min(1, currentStrain.strain + this.fatigueRate * mult);
		}

		// coordination degrades presses and releases alike
		currentStrain.release = currentStrain.strain;

		// at max strain the coordination may break down on this press: either a
		// held LN is fumble-released right as the new key goes down, or the new
		// note isn't pressed at all
		if (currentStrain.strain >= 1 && Math.random() < Coordination.ERROR_CHANCE) {
			this.breakDown(currentStrain, held, note);
		}

		if (note.hold) this.active.push({ note, strain: currentStrain });

		return currentStrain;
	}

	/** A coordination error on this press: either fumble-release a held LN, or
	 *  miss the new note entirely. */
	private breakDown(currentStrain: SkillStrain, held: ActiveHold[], note: RuntimeNote): void {
		const victim = held[Math.floor(Math.random() * held.length)];
		if (victim && Math.random() < Coordination.FUMBLE_SHARE) {
			victim.strain.forcedRelease!.at = note.time;
		} else {
			currentStrain.miss = true;
		}
	}

}
