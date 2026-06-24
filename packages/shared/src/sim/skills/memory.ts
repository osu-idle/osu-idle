import { SKILL } from '../../skills.js';
import type { BotContext } from '../bot.js';
import type {
	Strain,
	SkillStrain,
} from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import Synced from '../../helpers/synced.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import normalize from '../../math/normalize.js';
import lerp from '../../math/lerp.js';
import Skill from './skill.js';

/**
 * Memory - the SV-reading aid. The more this character has played a map, and the
 * higher this skill, the more of {@link SpeedJam}'s SV-reading error the player
 * "remembers away".
 *
 * Each note it deposits a `memoryReduction` (0..1) onto its strain entry;
 * SpeedJam - analyzed immediately after (see the order in `makeOrderedSkills`) - reads
 * it and scales its own press error down by that fraction, recording how much
 * jam error it actually shaved back onto this entry (`memoryCredit`). Memory's
 * XP is special-cased in {@link CharacterBot.getSkillsXP}: it earns from that
 * tamed error - organically "stealing" the SpeedJam XP it prevented.
 */
export default class Memory extends Skill {
	/** how many times this character cleared this map *before* the current attempt.
	 *  Seeded per play from server `beatmaps_played` / the local score count. */
	public readonly timesPlayed = new Synced(0);

	// Plays needed to reach min / max memorization, interpolated by skill: a
	// stronger memory saturates in fewer plays (low-skill ↔ high-skill bounds).
	public static readonly MIN_PLAYS_LOW = 2;
	public static readonly MIN_PLAYS_HIGH = 1;
	public static readonly MAX_PLAYS_LOW = 60;
	public static readonly MAX_PLAYS_HIGH = 18;

	// Ceiling on the fraction of SpeedJam error a fully-memorized map removes,
	// by skill: a novice shaves little even off a map they know by heart.
	public static readonly IMPROVE_MIN_MIN = 0.1;
	public static readonly IMPROVE_MIN_MAX = 0.2;
	public static readonly IMPROVE_MAX_MIN = 0.5;
	public static readonly IMPROVE_MAX_MAX = 0.95;

	// Skill-induced learning-rate boost: at high skill the memorization curve is
	// climbed faster within the [min, max] plays window (multiplies progress).
	public static readonly BOOST_MAX = 1.8;

	// Magnitude of the XP training weight. The `m * (1 - m)` hump peaks at 0.25, so
	// 4 lifts the peak to 1.0: a max-strain note at peak learning then credits memory
	// like a fully-blamed note credits any other skill (XP parity with the rest).
	public static readonly TRAIN_SCALE = 4;

	// times-played progress → memorization (0..1)
	private static readonly LEARN_CB = cubic_bezier(.2, 0, .15, 1);
	// skill → learning-rate boost shape
	private static readonly BOOST_CB = cubic_bezier(.77, .77, .35, .9);
	private static readonly IMPROVE_CB = cubic_bezier(.58, .17, .35, .87);
	// skill → the 0..1 factor every skill-interpolated knob reads
	private static readonly SKILL_CB = cubic_bezier(.22, 1, .87, .78);

	private minPlays!: number;
	private maxPlays!: number;
	private maxImprove!: number;
	private boost!: number;

	constructor(def = 0) {
		super(SKILL.memory, def);

		this.level.sync(level => {
			const p = Memory.SKILL_CB(Math.min(1, level / 100));
			const i = Memory.IMPROVE_CB(Math.min(1, level / 100));
			this.minPlays = lerp(Memory.MIN_PLAYS_LOW, Memory.MIN_PLAYS_HIGH, p);
			this.maxPlays = lerp(Memory.MAX_PLAYS_LOW, Memory.MAX_PLAYS_HIGH, p);
			this.maxImprove = lerp(
				lerp(Memory.IMPROVE_MIN_MIN, Memory.IMPROVE_MIN_MAX, i),
				lerp(Memory.IMPROVE_MAX_MIN, Memory.IMPROVE_MAX_MAX, i),
				p,
			);
			this.boost = lerp(1, Memory.BOOST_MAX, Memory.BOOST_CB(p));
		});
	}

	analyze(
		note: RuntimeNote, 
		_context: BotContext,
		mapStrain: Strain, 
		strain: Strain,
	): SkillStrain {
		const progress = Math.min(1,
			normalize(this.timesPlayed.get(), [this.minPlays, this.maxPlays])
			* this.boost,
		);
		const memorized = Memory.LEARN_CB(progress); // 0 = fresh map, 1 = fully recalled
		const reduction = memorized * this.maxImprove;

		const currentStrain: SkillStrain = {
			note,
			strain: 0,
			min: 0,
			max: 0,
			type: 'both',
			memoryReduction: reduction,
			// XP is earned while *learning*: a hump that is zero on a fresh map (nothing
			// memorized yet) and on a mastered one (no longer trained), peaking mid-recall.
			memoryTrain: Memory.TRAIN_SCALE * memorized * (1 - memorized),
		};

		strain.memory.push(currentStrain);
		mapStrain.memory.push(currentStrain);

		return currentStrain;
	}

}
