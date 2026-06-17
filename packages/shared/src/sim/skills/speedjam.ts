import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import avg from '../../math/avg.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import gaussian from '../../math/gaussian.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';
import clamp from '../../math/clamp.js';
import lerp from '../../math/lerp.js';

export type Group = {
	note: RuntimeNote,
	count: number,
	snap: number,
};

export default class SpeedJam extends Skill {
	public static readonly DECAY_BASE = 0.16;
	public static readonly DECAY_SKILLED = 1.1;

	private baseFactor = 0.3;
	private decayRate!: number;

	private jamFactor!: number;

	constructor(def = 0) {
		super(SKILL.speedjam, def);

		const fn = cubic_bezier(.3, 1, .8, .7);
		this.level.sync(level => {
			const p = fn(Math.min(1, level / 100));
			this.jamFactor = this.baseFactor - ((this.baseFactor - 0.05) * p + 0.05 * fn(Math.max(0, level - 100) / 100));
			this.decayRate = lerp(SpeedJam.DECAY_BASE, SpeedJam.DECAY_SKILLED, p);
		});
	}

	analyze(note: RuntimeNote, context: BotContext, mapStrain: Strain, strain: Strain): SkillStrain {
		const previous = mapStrain.speedjam.length > 0 ? mapStrain.speedjam[mapStrain.speedjam.length - 1] : undefined;
		const previousStrain = !previous ? 0 : previous.strain;
		const elapsed = previous ? note.time - previous.note.time : 0;
		const baseStrain = elapsed > 0 ? previousStrain * Math.exp(-this.decayRate * (elapsed / 1000)) : previousStrain;

		const speed = avg(context.scroll.getSpeedAt(note.time - 400), context.scroll.getSpeedAt(note.time - 200), context.scroll.getSpeedAt(note.time));
		const jam = cubic_bezier(.2, 0, .1, 1)(speed < 1 ? 1 - speed : clamp(speed - 1, 0, 1)) * 5;
		const currentStrain: SkillStrain = {
			note,
			strain: Math.min(1, baseStrain + cubic_bezier(.5, 0, .5, 1)(jam * this.jamFactor)),
			min: gaussian(this.jamFactor) * jam * 40,
			max: 125,
			type: speed === 1 ? 'both' : (speed < 1 ? 0.1 : 0.9),
		};

		// Memory (analyzed just before, same note) remembers part of the SV away:
		// scale this note's press error down by its reduction, and credit memory by
		// the jam strain times its training weight (read at XP time). Decay carries
		// the lowered strain forward, so a memorized passage stays calm note-to-note.
		const memory = mapStrain.memory[mapStrain.memory.length - 1];
		const reduction = memory?.note === note ? (memory.memoryReduction ?? 0) : 0;
		if (reduction > 0) {
			memory!.memoryCredit = currentStrain.strain * (memory!.memoryTrain ?? 0);
			currentStrain.strain *= 1 - reduction;
			currentStrain.min *= 1 - reduction;
		}

		strain.speedjam.push(currentStrain);
		mapStrain.speedjam.push(currentStrain);

		return currentStrain;
	}

}
