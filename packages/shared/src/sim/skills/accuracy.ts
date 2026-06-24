import type { BotContext } from '../bot.js';
import type {
	Strain,
	SkillStrain,
} from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import gaussian from '../../math/gaussian.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';
import normalize from '../../math/normalize.js';

const MIN_BAD_MS = 6;
const MAX_BAD_MS = 12;
export const MIN_MAX_BAD_MS = 80;

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

	private static fn = cubic_bezier(1, .3, .9, .5);
	
	private bad!: number;
	private minMs!: number;
	private maxMs!: number;

	constructor(def = 0) {
		super(SKILL.accuracy, def);

		this.level.sync(level => {
			const { bad, minMs, maxMs } = Accuracy.computeForLevel(level);
			this.bad = bad;
			this.minMs = minMs;
			this.maxMs = maxMs;
		});
	}

	public static computeForLevel(level: number) {
		const base = normalize(level, [0, 100]) / 2;
		const bonus = normalize(level, [100, 200]) / 2;
		const bad = this.fn(1 - base - bonus);

		return {
			bad,
			minMs: (MIN_BAD_MS * bad) * Math.max(1, MIN_BAD_MS * bad),
			maxMs: (MAX_BAD_MS * bad) * Math.max(1, MAX_BAD_MS * bad),
		};
	}

	analyze(
		note: RuntimeNote, 
		_context: BotContext, 
		mapStrain: Strain, 
		strain: Strain,
	): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: this.bad,
			min: gaussian(this.minMs),
			max: MIN_MAX_BAD_MS + gaussian(this.maxMs),
			type: 'both',
			centerFactor: 0.75,
		};

		strain.accuracy.push(currentStrain);
		mapStrain.accuracy.push(currentStrain);

		return currentStrain;
	}

}
