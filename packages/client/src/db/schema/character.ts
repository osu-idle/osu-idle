import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import {
	Column,
	DAO,
	DB,
	Insert,
	integer,
	real,
	table,
	text,
} from '../dao';
import Synced from '@osu-idle/shared/helpers/synced';
import { CharacterDTO } from '@osu-idle/shared/character';
import type { SkillName } from '@osu-idle/shared/skills';
import { xpGivesLevel } from '@osu-idle/shared/sim/skills/xp';

export type { SkillName } from '@osu-idle/shared/skills';

export const STATUS = mapped(['IDLE']);
export type CharacterStatus = ValueIn<typeof STATUS>;

const skillColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [j, integer().default(0)]),
) as Record<SkillName, Column<number, true>>;

const xpColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}XP`, integer().default(0)]),
) as Record<`${SkillName}XP`, Column<number, true>>;

const upgradeColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}Upgrades`, integer().default(0)]),
) as Record<`${SkillName}Upgrades`, Column<number, true>>;

const overdriveColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}Overdrive`, real().default(0)]),
) as Record<`${SkillName}Overdrive`, Column<number, true>>;

const totalXpColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}TotalXp`, integer().default(0)]),
) as Record<`${SkillName}TotalXp`, Column<number, true>>;

const lifetimeXpColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}LifetimeXp`, integer().default(0)]),
) as Record<`${SkillName}LifetimeXp`, Column<number, true>>;

const prestigeColumns = Object.fromEntries(
	makeOrderedSkills().map(s => s.name).map(j => [`${j}Prestige`, integer().default(0)]),
) as Record<`${SkillName}Prestige`, Column<number, true>>;

const t = table('character', {
	id:          integer().primaryKey().autoincrement(),
	name:        text(),
	...skillColumns,
	...xpColumns,
	...upgradeColumns,
	...overdriveColumns,
	...prestigeColumns,
	...totalXpColumns,
	...lifetimeXpColumns,
	overallTotalXp: integer().default(0),
	overallLevel:   integer().default(0),
	generation:  integer().default(1),
	// when memory was last prestiged: plays before it no longer train it
	memoryResetAt: integer().default(0),
	local:       integer().default(0),
	current:     integer().default(0),
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
			skill.upgrades.set(this[`${skill.name}Upgrades`]);
			skill.overdrive.set(this[`${skill.name}Overdrive`]);
			skill.prestige.set(this[`${skill.name}Prestige`]);
		});
	}

	public async persistSkills(): Promise<void> {
		for (const skill of this.skills) {
			this[skill.name] = skill.level.get();
			this[`${skill.name}XP`] = skill.xp.get();
			this[`${skill.name}Upgrades`] = skill.upgrades.get();
			this[`${skill.name}Overdrive`] = skill.overdrive.get();
			this[`${skill.name}Prestige`] = skill.prestige.get();
		}
		await this.update();
	}

	/** Book a finished guest play's xp into the totals the overall level - and so
	 *  the rebirth requirement - is derived from. Prestige never takes these back. */
	public async addProgression(gains: readonly { skill: SkillName, gained: number }[]): Promise<void> {
		let overall = 0;
		for (const g of gains) {
			const gained = Math.round(g.gained);
			this[`${g.skill}TotalXp`] += gained;
			this[`${g.skill}LifetimeXp`] += gained;
			overall += gained;
		}
		this.overallTotalXp += overall;
		this.overallLevel = xpGivesLevel(this.overallTotalXp).level;
		await this.persistSkills();
	}

	/** Spend a purchase's XP out of the lifetime totals, like the server route
	 *  does, so buying upgrades costs a guest the same overall levels. */
	public async spendXP(skill: SkillName, spent: number): Promise<void> {
		const amount = Math.round(spent);
		this[`${skill}TotalXp`] = Math.max(0, this[`${skill}TotalXp`] - amount);
		this.overallTotalXp = Math.max(0, this.overallTotalXp - amount);
		this.overallLevel = xpGivesLevel(this.overallTotalXp).level;
		await this.persistSkills();
	}

	/** Make this the local character `guest()` returns, across reloads. */
	public async makeCurrent(): Promise<void> {
		await DB.run('UPDATE character SET current = 0 WHERE local = 1');
		this.current = 1;
		await this.update();
	}

	public static async newCharacter(name?: string, generation = 1): Promise<Character> {
		name = name ?? 'Guest';
		const character = await new Character({
			id: await Character.nextLocalId(),
			name,
			generation,
			local: 1,
		}).add();
		await character.makeCurrent();
		return character;
	}

	/** Local characters live below zero: the table also caches server characters
	 *  by their own id, and the two id spaces must never meet. */
	private static async nextLocalId(): Promise<number> {
		return await DB.read(db => {
			const res = db.exec('SELECT COALESCE(MIN(id), 0) - 1 AS id FROM character WHERE id < 0');
			return (res[0]?.values[0][0] as number) ?? -1;
		});
	}

	/** The live offline character: whichever local one was last played, else the
	 *  newest generation. */
	public static async guest(): Promise<Character> {
		const current = await Character.first(
			'SELECT * FROM character WHERE local = 1 ORDER BY current DESC, generation DESC LIMIT 1',
		);
		return current ?? await Character.newCharacter();
	}

	/** Whether an id belongs to the local lineage rather than a server character. */
	public static isLocalId(id: number): boolean {
		return id < 0;
	}

	public static async locals(): Promise<Character[]> {
		return await Character.query('SELECT * FROM character WHERE local = 1 ORDER BY generation');
	}
	
	static fromDTO(dto: CharacterDTO): Character {
		const { skills, ...rest } = dto;
		const skillData = Object.fromEntries(
			Object.entries(skills).flatMap(([name, {
				level, xp, upgrades, overdrive, prestige, lifetimeXp,
			}]) => [
				[name, level],
				[`${name}XP`, xp],
				[`${name}Upgrades`, upgrades],
				[`${name}Overdrive`, overdrive],
				[`${name}Prestige`, prestige],
				[`${name}LifetimeXp`, lifetimeXp],
			]),
		);
		return new Character({
			...rest, ...skillData, local: 0,
		});
	}

	public isGuest(): boolean {
		return this.local === 1;
	}
}