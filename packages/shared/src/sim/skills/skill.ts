import type { BotContext } from '../bot.js';
import type {
	Strain,
	SkillStrain,
} from '../bots/character.js';
import type RuntimeNote from '../runtimeNote.js';
import Synced from '../../helpers/synced.js';
import type { SkillName } from '../../skills.js';
import { xpForLevel } from './xp.js';
import { skillXPMultiplier } from '../../upgrades.js';
import {
	effectiveLevelOf,
	mapLevel,
} from './levelCurve.js';

export default abstract class Skill {

	public readonly level = new Synced(0);
	public readonly xp = new Synced(0);
	public readonly upgrades = new Synced(0);
	public readonly overdrive = new Synced(0);
	public readonly prestige = new Synced(0);

	constructor(
		public readonly name: SkillName,
		def: number = 0,
	) {
		if (def !== 0) this.level.set(def);
	}

	abstract analyze(
		note: RuntimeNote, 
		context: BotContext, 
		mapStrain: Strain, 
		colStrain: Strain,
		prev?: RuntimeNote, 
		next?: RuntimeNote
	): SkillStrain;

	public static xpForLevel(level: number): number {
		return xpForLevel(level);
	}

	public xpMultiplier(): number {
		return skillXPMultiplier(
			this.upgrades.get(),
			this.overdrive.get(),
			this.prestige.get(),
		);
	}

	/** Effective level: what the player earned, how far into the next level they
	 *  are, and what prestige granted. The same number the player is shown. */
	public effectiveLevel(): number {
		return effectiveLevelOf(this.level.get(), this.xp.get(), this.prestige.get());
	}

	/** Subscribe to the mapped level the strain curves read. Skills use this
	 *  instead of level.sync so prestige bonuses and the xp banked inside the
	 *  current level reach their rates - a play gets better as it earns, not
	 *  only when the level flips. */
	protected syncSkillLevel(apply: (level: number) => void): void {
		const run = () => apply(mapLevel(this.effectiveLevel()));
		void this.level.sync(run);
		void this.xp.sync(run);
		void this.prestige.sync(run);
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
