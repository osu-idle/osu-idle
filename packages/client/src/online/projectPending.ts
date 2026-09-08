import {
	applyPrestige,
	applyUpgrade,
} from '@osu-idle/shared/upgrades';
import type { PendingAction } from '@osu-idle/shared/pendingAction';
import type Character from '../db/schema/character';

/**
 * Show the character as it will be once the running play ends.
 *
 * Purchases made during a play are parked server-side and applied when the play
 * ends, so the row the server hands back until then is genuinely unspent. Left
 * alone, reloading mid-play shows the levels back and offers the same purchase
 * again - the server refuses it, but only after the click.
 *
 * The parked actions come down with the character, so they are run through it
 * here, with the same shared math the server will use. Nothing is written: this
 * is the display catching up with a decision already made.
 */
export const projectPending = (
	character: Character,
	actions: PendingAction[] | undefined,
): void => {
	for (const action of actions ?? []) {
		if (action.type === 'rebirth') continue;
		const skill = character.skills.find(s => s.name === action.skill);
		if (!skill) continue;
		try {
			const next = action.type === 'upgrade'
				? applyUpgrade({
					level: skill.level.get(),
					xp: skill.xp.get(),
					upgrades: skill.upgrades.get(),
					overdrive: skill.overdrive.get(),
					prestige: skill.prestige.get(),
				})
				: applyPrestige({
					level: skill.level.get(),
					xp: skill.xp.get(),
					upgrades: skill.upgrades.get(),
					overdrive: skill.overdrive.get(),
					prestige: skill.prestige.get(),
				});
			void skill.level.set(next.level);
			void skill.xp.set(next.xp);
			void skill.upgrades.set(next.upgrades);
			void skill.overdrive.set(next.overdrive);
			if ('prestige' in next) void skill.prestige.set(next.prestige);
		} catch {
			// one the character cannot afford will be dropped server-side too
		}
	}
};
