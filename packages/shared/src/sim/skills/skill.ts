import type { BotContext } from '../bot.js';
import type { Strain, SkillStrain } from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import Synced from '../../helpers/synced.js';
import type { SkillName } from '../../skills.js';
import { xpForLevel } from './xp.js';

export default abstract class Skill {

	public readonly level = new Synced(0);
	public readonly xp = new Synced(0);

	constructor(
		public readonly name: SkillName,
		def: number = 0,
	) {
		if (def !== 0) this.level.set(def);
	}

	abstract analyze(note: RuntimeNote, context: BotContext, mapStrain: Strain, colStrain: Strain, prev?: RuntimeNote, next?: RuntimeNote): SkillStrain;

	public static xpForLevel(level: number): number {
		return xpForLevel(level);
	}

	gainXP(xp: number): number {
		this.xp.set(this.xp.get() + xp);
		let levelsGained = 0;
		do {
			const xpNeeded = Skill.xpForLevel(this.level.get());
			if (this.xp.get() > xpNeeded) {
				this.xp.set(this.xp.get() - xpNeeded);
				this.level.set(this.level.get() + 1);
				levelsGained++;
			} else {
				break;
			}
		} while(true);

		return levelsGained;
	}
}
