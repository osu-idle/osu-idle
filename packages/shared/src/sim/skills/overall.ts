import type { SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import Skill from './skill.js';

export default class Overall extends Skill {

	constructor(def = 0) {
		super('accuracy', def);
	}

	analyze(note: RuntimeNote): SkillStrain {
		const currentStrain: SkillStrain = {
			note,
			strain: 0,
			min: 0,
			max: 1,
			type: 'both',
		};

		return currentStrain;
	}

}
