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

	// a guest's play is already resolved, so nothing it does now can reach it
	if (character.isGuest()) return prestigeLocally(character, skillName);

	const res = await rpc.v1.me.prestige.$post({ json: { skill: skillName } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Prestige failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	const body = await res.json();
	// parked behind a running play: spend it here now, exactly as the server
	// will when the play ends. Without this the button looks broken - and gets
	// pressed again, parking a second prestige nobody asked for.
	if (body.queued) return prestigeLocally(character, skillName);

	const dto = body.character;
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};

/** Run the prestige against the character in hand, with the shared math. */
const prestigeLocally = async (
	character: Character,
	skillName: SkillName,
): Promise<boolean> => {
	const skill = character.skills.find(s => s.name === skillName);
	if (!skill) return false;
	let spent = 0;
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
		spent = next.spent;
	} catch {
		return false;
	}
	// memory's progress is the maps it has learned, so that is what its
	// prestige spends - the scores themselves stay for the profile
	if (skillName === SKILL.memory) character.memoryResetAt = Date.now();
	// and the levels it reset stop counting toward the overall level, the
	// same way the server route drops them
	await character.spendXP(skillName, spent);
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
	const body = await res.json();
	// a rebirth parked behind a play makes a character that does not exist yet -
	// there is nothing honest to show until the play ends and the server makes it
	if (body.queued) {
		Log.popup('Rebirth will happen when this play ends');
		return true;
	}

	const dto = body.character;
	flushCharacter(dto.id);
	flushCharacterStats(dto.id);
	await Account.character.set(dto);
	return true;
};
