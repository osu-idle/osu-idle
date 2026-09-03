import type { SkillName } from '@osu-idle/shared/skills';
import { applyUpgrade } from '@osu-idle/shared/upgrades';
import Log from '@osu-idle/shared/helpers/log';
import { rpc } from '../client';
import Account from '../account';
import Entities from '../../entity/entities';
import {
	flushCharacter,
	flushCharacterStats,
} from './characters';

/** Buy the live character's next upgrade: guests locally, signed-in via the
 *  server. Returns true when it landed. */
export const purchaseUpgrade = async (skillName: SkillName): Promise<boolean> => {
	const character = Entities.character.get();
	if (character.id === 0) return false;

	if (character.isGuest()) {
		const skill = character.skills.find(s => s.name === skillName);
		if (!skill) return false;
		try {
			const purchase = applyUpgrade({
				level: skill.level.get(),
				xp: skill.xp.get(),
				upgrades: skill.upgrades.get(),
				overdrive: skill.overdrive.get(),
			});
			skill.level.set(purchase.level);
			skill.xp.set(purchase.xp);
			skill.upgrades.set(purchase.upgrades);
			skill.overdrive.set(purchase.overdrive);
		} catch {
			return false;
		}
		await character.persistSkills();
		return true;
	}

	const res = await rpc.v1.me.upgrade.$post({ json: { skill: skillName } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Upgrade failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	const { character: dto } = await res.json();
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};
