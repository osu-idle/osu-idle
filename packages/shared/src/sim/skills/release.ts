import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import cubic_bezier from '../../math/cubic_bezier.js';
import Skill from './skill.js';
import { SKILL } from '../../skills.js';

export default class Release extends Skill {

	private recoveryRate!: number;
	private fatigueRate!: number;
	private precision!: number;
	private baseImprecision!: number;

	constructor(def = 0) {
		super(SKILL.release, def);

		const fn = cubic_bezier(0,.65,1,.45);
		const fnBase = cubic_bezier(.5,1,.95,.8);
		this.level.sync(level => {
			const levelNerf = fnBase(Math.min(1, level / 100)) * 7;
			level -= levelNerf;
			this.precision = level / 120;

			const base = fnBase(Math.max(0, 1 - ((level) / 120)));
			const base2 = fnBase(Math.max(0, 1 - (level / 150)));
			this.baseImprecision =  base * (0.10 + 0.02 * base2);

			this.recoveryRate = 0.005 * fn(Math.min(1, level / 100)) + 0.005 * fn(Math.max(0, (level - 100) / 100));
			this.fatigueRate = 0.0008 * (1 - fn(Math.min(1, level / 100)));
		});
	}

	analyze(note: RuntimeNote, _context: BotContext, mapStrain: Strain, colStrain: Strain): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: 0,
			min: 0,
			max: 90,
			type: 'both',
		};

		if (!note.hold) return currentStrain;

		const previous = mapStrain.release.length > 0 ? mapStrain.release[mapStrain.release.length - 1] : undefined;

		colStrain.release.push(currentStrain);
		mapStrain.release.push(currentStrain);

		// time-based recovery, like stamina/coordination: the previous strain
		// bleeds off exponentially over the time since the last hold (a long
		// LN-free stretch recovers fully), then this hold adds its fatigue step -
		// so close LN chains accumulate faster than they can recover
		const elapsed = previous ? note.time - previous.note.time : 0;
		let release = previous?.release ?? 0;
		if (elapsed > 0) release *= Math.exp(-this.recoveryRate * (elapsed / 1000));
		currentStrain.release = Math.max(0, Math.min(1, release + this.fatigueRate));

		// the precision floor is resting imprecision, not stress - declare it as
		// the baseline so the strain HUD only shows the fatigue built above it
		const floor = (1 - (this.precision - this.baseImprecision)) * 0.65;
		currentStrain.release = Math.max(floor, currentStrain.release);
		currentStrain.baseline = floor;
		currentStrain.centerFactor = Math.max(0.5, ((this.precision - this.baseImprecision) * 2.5) - 1);

		return currentStrain;
	}

}
