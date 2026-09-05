import {
	SKILL,
	type SkillName,
} from '@osu-idle/shared/skills';
import {
	applyPrestige,
	canRebirth,
} from '@osu-idle/shared/upgrades';
import Log from '@osu-idle/shared/helpers/log';
import { rpc } from '../client';
import Account from '../account';
import Entities from '../../entity/entities';
import Character from '../../db/schema/character';
import {
	flushCharacter,
	flushCharacterStats,
} from './characters';

/** Prestige one skill of the live character: guests locally, signed-in via the
 *  server. Returns true when it landed. */
export const prestigeSkill = async (skillName: SkillName): Promise<boolean> => {
	const character = Entities.character.get();
	if (character.id === 0) return false;

	if (character.isGuest()) {
		const skill = character.skills.find(s => s.name === skillName);
		if (!skill) return false;
		try {
			const next = applyPrestige({
				level: skill.level.get(),
				xp: skill.xp.get(),
				upgrades: skill.upgrades.get(),
				overdrive: skill.overdrive.get(),
				prestige: skill.prestige.get(),
			});
			skill.level.set(next.level);
			skill.xp.set(next.xp);
			skill.upgrades.set(next.upgrades);
			skill.overdrive.set(next.overdrive);
			skill.prestige.set(next.prestige);
		} catch {
			return false;
		}
		// memory's progress is the maps it has learned, so that is what its
		// prestige spends - the scores themselves stay for the profile
		if (skillName === SKILL.memory) character.memoryResetAt = Date.now();
		await character.persistSkills();
		return true;
	}

	const res = await rpc.v1.me.prestige.$post({ json: { skill: skillName } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Prestige failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	const dto = await res.json();
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};

/** Whether the live character has reached the overall level rebirth needs. */
export const rebirthAvailable = (): boolean => {
	const character = Entities.character.get();
	return character.id !== 0 && canRebirth(character.overallLevel);
};

/** Start a fresh character one generation up. The previous one stays playable
 *  and keeps everything but its name. */
export const rebirth = async (name: string): Promise<boolean> => {
	const character = Entities.character.get();
	if (character.id === 0) return false;

	if (character.isGuest()) {
		if (!canRebirth(character.overallLevel)) return false;

		character.name = `${character.name}_old`;
		await character.update();

		const fresh = await Character.newCharacter(name, character.generation + 1);
		Entities.character.set(fresh);
		return true;
	}

	const res = await rpc.v1.me.rebirth.$post({ json: { name } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Rebirth failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	const dto = await res.json();
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};
