import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import {
	Column,
	DAO,
	Insert,
	integer,
	table,
	text,
} from '../dao';
import Synced from '@osu-idle/shared/helpers/synced';
import { CharacterDTO } from '@osu-idle/shared/character';
import type { SkillName } from '@osu-idle/shared/skills';

export type { SkillName } from '@osu-idle/shared/skills';

export const STATUS = mapped(['IDLE']);
export type CharacterStatus = ValueIn<typeof STATUS>;

const skillColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [j, integer().default(0)]),
) as Record<SkillName, Column<number, true>>;

const xpColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}XP`, integer().default(0)]),
) as Record<`${SkillName}XP`, Column<number, true>>;

const t = table('character', {
	id:          integer().primaryKey().autoincrement(),
	name:        text(),
	...skillColumns,
	...xpColumns,
});

export type CharacterData = Insert<typeof t.columns>;

export default class Character extends DAO(t) {

	public readonly skills = makeOrderedSkills();
	public readonly status = new Synced<CharacterStatus>(STATUS.IDLE);

	constructor(row: CharacterData) {
		super(row);

		this.skills.forEach(skill => {
			skill.level.set(this[skill.name]);
			skill.xp.set(this[`${skill.name}XP`]);
		});
	}

	public async persistSkills(): Promise<void> {
		for (const skill of this.skills) {
			this[skill.name] = skill.level.get();
			this[`${skill.name}XP`] = skill.xp.get();
		}
		await this.update();
	}

	public static async newCharacter(name?: string): Promise<Character> {
		name = name ?? 'Guest';
		return await new Character({
			id: name === 'Guest' ? 1 : undefined,
			name,
		}).add();
	}

	public static async guest(): Promise<Character> {
		return (await Character.get({ id: 1 })) ?? await Character.newCharacter();
	}
	
	static fromDTO(dto: CharacterDTO): Character {
		const { skills, ...rest } = dto;
		const skillData = Object.fromEntries(
			Object.entries(skills).flatMap(([name, { level, xp }]) => 
				[ [name, level], [`${name}XP`, xp ] ]),
		);
		const char = new Character({
			...rest, ...skillData, 
		});
		return char;
	}

	public isGuest(): boolean {
		return this.id <= 1;
	}
}