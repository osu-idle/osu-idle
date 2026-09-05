import {
	Skills,
	type SkillName,
} from '../skills.js';

type SkillLevels = Record<SkillName, {
	level: number, xp: number, prestige: number, lifetimeXp: number,
}>;
// prestige and the lifetime total are optional: not every shape carrying skill
// levels has been through a character row.
type SkilledCharacter = { id: number } 
	& Record<`${SkillName}Level` | `${SkillName}Xp`, number>
	& Partial<Record<`${SkillName}Prestige` | `${SkillName}LifetimeXp`, number>>;

export const extractSkills = (character: SkilledCharacter): SkillLevels => {
	const skills: SkillLevels = {} as SkillLevels;
	for(const skill of Skills) {
		skills[skill] = {
			level: character[`${skill}Level`] ?? 0,
			xp: character[`${skill}Xp`] ?? 0,
			prestige: character[`${skill}Prestige`] ?? 0,
			lifetimeXp: character[`${skill}LifetimeXp`] ?? 0,
		};
	}

	return skills;
};