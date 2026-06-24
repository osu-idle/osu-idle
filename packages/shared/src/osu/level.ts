import {
	Skills,
	type SkillName,
} from '../skills.js';

type SkillLevels = Record<SkillName, {level: number, xp: number}>;
type SkilledCharacter = { id: number } 
	& Record<`${SkillName}Level` | `${SkillName}Xp`, number>;

export const extractSkills = (character: SkilledCharacter): SkillLevels => {
	const skills: SkillLevels = {} as SkillLevels;
	for(const skill of Skills) {
		skills[skill] = {
			level: character[`${skill}Level`] ?? 0,
			xp: character[`${skill}Xp`] ?? 0,
		};
	}

	return skills;
};