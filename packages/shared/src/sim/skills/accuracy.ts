import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import gaussian from '../../math/gaussian.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';

/**
 * Accuracy skill is exponentially good (from level 0 to 200)
 *
 * 0 => Beginner player (90% on beginner)
 * 10 => Struggles to SS any map (nearly impossible)
 * 25 => Struggles to SS any map (very hard)
 * 50 => Can SS maps most of the time
 * 90 => Can SS maps with very good ratios
 * 100 => Can 1M most maps with 60UR
 * 110 => Can 1M most maps with 50UR
 * 120 => Can 1M most maps with 30UR -> human limit
 * 150 => Perfect bot with 0 UR
 */
export default class Accuracy extends Skill {

	private factor!: number;

	constructor(def = 0) {
		super(SKILL.accuracy, def);

		const fn = cubic_bezier(1, .3, .9, .5);
		this.level.sync(level => {
			this.factor = fn(1 - (Math.min(100, level) / 200) - (level > 100 ? (level - 100) / 100 : 0));
		});
	}

	analyze(note: RuntimeNote, _context: BotContext, mapStrain: Strain, strain: Strain): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: this.factor,
			min: gaussian((6 * this.factor) * Math.max(1, 6 * this.factor)),
			max: 80 + gaussian((12 * this.factor) * Math.max(1, 12 * this.factor)),
			type: 'both',
			centerFactor: 0.75,
		};

		strain.accuracy.push(currentStrain);
		mapStrain.accuracy.push(currentStrain);

		return currentStrain;
	}

}
