import type { SkillName } from '@osu-idle/shared/skills';
import { applyUpgrade } from '@osu-idle/shared/upgrades';
import Log from '@osu-idle/shared/helpers/log';
import { rpc } from '../client';
import Account from '../account';
import Entities from '../../entity/entities';
import type Character from '../../db/schema/character';
import {
	flushCharacter,
	flushCharacterStats,
} from './characters';

/** Buy the live character's next upgrade: guests locally, signed-in via the
 *  server. Returns true when it landed. */
export const purchaseUpgrade = async (skillName: SkillName): Promise<boolean> => {
	const character = Entities.character.get();
	if (character.id === 0) return false;

	// a guest's play is already resolved, so nothing it does now can reach it:
	// the purchase simply happens
	if (character.isGuest()) return spendLocally(character, skillName);

	const res = await rpc.v1.me.upgrade.$post({ json: { skill: skillName } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Upgrade failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	const body = await res.json();
	// Parked behind a running play: the server does it when the play ends, and
	// until then the character here spends it exactly as it will there. The real
	// values land when the play ends and the character is re-read.
	if ('queued' in body && body.queued) return spendLocally(character, skillName);

	const dto = body.character;
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};

/** Run the purchase against the character in hand, with the shared math. */
const spendLocally = async (
	character: Character,
	skillName: SkillName,
): Promise<boolean> => {
	const skill = character.skills.find(s => s.name === skillName);
	if (!skill) return false;
	let spent = 0;
	try {
		const purchase = applyUpgrade({
			level: skill.level.get(),
			xp: skill.xp.get(),
			upgrades: skill.upgrades.get(),
			overdrive: skill.overdrive.get(),
			prestige: skill.prestige.get(),
		});
		skill.level.set(purchase.level);
		skill.xp.set(purchase.xp);
		skill.upgrades.set(purchase.upgrades);
		skill.overdrive.set(purchase.overdrive);
		spent = purchase.spent;
	} catch {
		return false;
	}
	await character.spendXP(skillName, spent);
	return true;
};
