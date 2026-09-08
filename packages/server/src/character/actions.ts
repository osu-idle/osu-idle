import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
	characters,
	type CharacterRow,
} from '../db/schema/character';
import {
	users,
	type UserRow,
} from '../db/schema/user';
import { characterNameHistory } from '../db/schema/name_history';
import { reindexCharacter } from '../rankings';
import { hub } from '../ws/hub';
import { rekey as presenceRekey } from '../ws/presence';
import { resetMemory } from '../db/schema/beatmaps_played';
import {
	applyPrestige,
	applyUpgrade,
	canPrestige,
	canRebirth,
	canUpgrade,
	type UpgradeState,
} from '@osu-idle/shared/upgrades';
import { xpGivesLevel } from '@osu-idle/shared/sim/skills/xp';
import {
	SKILL,
	type SkillName,
} from '@osu-idle/shared/skills';
import {
	assertNameAvailable,
	displacedName,
} from './names';
import type { PendingAction } from '@osu-idle/shared/pendingAction';

/**
 * The three progression loops, as plain functions on a character row.
 *
 * They live here rather than inside their routes because a play in progress
 * defers them: the same purchase runs either from the request or, later, from
 * the play's finalise (see character/pending.ts). Two copies of this arithmetic
 * would drift.
 */

/** The character row, locked for the rest of the transaction. */
const lockCharacter = async (
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	id: number,
): Promise<CharacterRow> => {
	const [row] = await tx
		.select()
		.from(characters)
		.where(eq(characters.id, id))
		.limit(1)
		.for('update');
	if (!row) throw new HTTPException(409, { message: 'No character' });
	return row;
};

const skillState = (row: CharacterRow, skill: SkillName) => ({
	level: row[`${skill}Level`],
	xp: row[`${skill}Xp`],
	upgrades: row[`${skill}Upgrades`],
	overdrive: row[`${skill}Overdrive`],
	prestige: row[`${skill}Prestige`],
});

/** Spending is global: the spent XP also leaves the lifetime totals that
 *  rankings and the overall level are built on. */
const spendTotals = (row: CharacterRow, skill: SkillName, spent: number) => {
	const skillTotalXp = Math.max(0, row[`${skill}TotalXp`] - spent);
	const overallTotalXp = Math.max(0, row.overallTotalXp - spent);
	const overall = xpGivesLevel(overallTotalXp);
	return {
		[`${skill}TotalXp`]: skillTotalXp,
		overallTotalXp,
		overallLevel: overall.level,
		overallXp: Math.round(overall.xp),
	};
};

/**
 * A skill as it will be once everything already parked has run.
 *
 * Checking a new purchase against the character as it stands today would let
 * you buy the same upgrade twice during one play, or park a prestige you can no
 * longer afford - the first of them spends what the second needs, and only the
 * second finds out, silently, when the play ends.
 */
const projectSkill = (
	row: CharacterRow,
	parked: PendingAction[],
	skill: SkillName,
): UpgradeState => {
	let state: UpgradeState = skillState(row, skill);
	for (const action of parked) {
		if (action.type === 'rebirth' || action.skill !== skill) continue;
		try {
			state = action.type === 'upgrade' ? applyUpgrade(state) : applyPrestige(state);
		} catch {
			// one that will not apply leaves the projection where it was
		}
	}
	return state;
};

/**
 * The overall level once everything already parked has run. Upgrades and
 * prestiges spend lifetime xp, and the overall level is derived from it, so a
 * rebirth checked against today's level is accepted and then refused for real
 * when its turn comes - silently, long after the player was told it would
 * happen.
 */
const projectOverallLevel = (row: CharacterRow, parked: PendingAction[]): number => {
	let spent = 0;
	for (let i = 0; i < parked.length; i++) {
		const action = parked[i];
		if (action.type === 'rebirth') continue;
		const state = projectSkill(row, parked.slice(0, i), action.skill);
		try {
			const next = action.type === 'upgrade' ? applyUpgrade(state) : applyPrestige(state);
			spent += Math.round(next.spent);
		} catch {
			// one that will not apply spends nothing
		}
	}
	return xpGivesLevel(Math.max(0, row.overallTotalXp - spent)).level;
};

/** The same availability check the action itself makes, run before parking one
 *  so an impossible request is refused now instead of being dropped silently
 *  when the play ends. `parked` is what is already waiting on this character. */
export const assertActionAvailable = (
	row: CharacterRow,
	action: PendingAction,
	parked: PendingAction[] = [],
): void => {
	// Everything behind a rebirth would land on a character that does not exist
	// yet - a fresh generation with no levels to spend - so it would be taken now
	// and dropped when its turn came. Refuse it at the click instead.
	if (parked.some(a => a.type === 'rebirth')) {
		throw new HTTPException(409, { message: 'A rebirth is queued: nothing else can be bought until this play ends' });
	}
	switch (action.type) {
		case 'upgrade':
			if (!canUpgrade(projectSkill(row, parked, action.skill))) {
				throw new HTTPException(409, { message: 'Upgrade not purchasable' });
			}
			return;
		case 'prestige':
			if (!canPrestige(projectSkill(row, parked, action.skill))) {
				throw new HTTPException(409, { message: 'Prestige not available' });
			}
			return;
		case 'rebirth':
			if (!canRebirth(projectOverallLevel(row, parked))) {
				throw new HTTPException(409, { message: 'Rebirth not available' });
			}
			return;
	}
};

/** Buy a skill's next upgrade: spend levels (and their lifetime XP, so
 *  leaderboards drop too) per the shared math. */
export const performUpgrade = async (
	row: CharacterRow,
	skill: SkillName,
): Promise<{ spent: number, ratio: number }> => {
	const purchase = await db.transaction(async tx => {
		// Re-read under the lock applySkillXp takes. The row handed in was read
		// when the request arrived, and everything below is derived from it - a
		// play finalising in between would have its whole xp written back out of
		// that stale snapshot, since the columns it moves are not all in the
		// conditional where.
		const current = await lockCharacter(tx, row.id);
		const state = skillState(current, skill);
		if (!canUpgrade(state)) {
			throw new HTTPException(409, { message: 'Upgrade not purchasable' });
		}
		const next = applyUpgrade(state);
		const spent = Math.round(next.spent);

		const updates = {
			[`${skill}Level`]: next.level,
			[`${skill}Xp`]: Math.round(next.xp),
			[`${skill}Upgrades`]: next.upgrades,
			[`${skill}Overdrive`]: next.overdrive,
			...spendTotals(current, skill, spent),
		} as Record<`${SkillName}${'Level' | 'Xp' | 'TotalXp' | 'Upgrades' | 'Overdrive'}`
		| `overall${'Level' | 'Xp' | 'TotalXp'}`, number>;

		await tx.update(characters).set(updates).where(eq(characters.id, row.id));
		return {
			spent, ratio: next.ratio,
		};
	});

	await reindexCharacter(row.id);
	return purchase;
};

/** Prestige one skill: its level, xp, upgrades and overdrive go, and it keeps a
 *  bonus level, an extra gear tier and a bigger multiplier. Lifetime totals and
 *  the ranking metrics are deliberately left alone. */
export const performPrestige = async (
	row: CharacterRow,
	skill: SkillName,
): Promise<void> => {
	// same lock, same reason as performUpgrade
	await db.transaction(async tx => {
		const current = await lockCharacter(tx, row.id);
		const state = skillState(current, skill);
		if (!canPrestige(state)) {
			throw new HTTPException(409, { message: 'Prestige not available' });
		}
		const next = applyPrestige(state);

		// the levels it just reset stop counting toward the overall level too,
		// so prestiging everything actually walks the character back down.
		// Lifetime is deliberately left alone - the tooltip reads off it.
		const spent = Math.round(next.spent);

		const updates = {
			[`${skill}Level`]: next.level,
			[`${skill}Xp`]: next.xp,
			[`${skill}Upgrades`]: next.upgrades,
			[`${skill}Overdrive`]: next.overdrive,
			[`${skill}Prestige`]: next.prestige,
			...spendTotals(current, skill, spent),
		} as Record<`${SkillName}${'Level' | 'Xp' | 'TotalXp' | 'Upgrades' | 'Overdrive' | 'Prestige'}`
		| `overall${'Level' | 'Xp' | 'TotalXp'}`, number>;

		await tx.update(characters).set(updates).where(eq(characters.id, row.id));
	});

	// memory's progress is the maps it has learned, so that is what its
	// prestige spends - the play counts the profile shows are left alone
	if (skill === SKILL.memory) await resetMemory(row.id);

	await reindexCharacter(row.id);
};

/** Rebirth: the account starts a fresh character one generation up, which owns
 *  one more unlock. The previous one stays playable, ranked, and keeps its
 *  progress - it just gives up the name, osu!-style. Returns the new id. */
export const performRebirth = async (
	user: UserRow,
	row: CharacterRow,
	name: string,
): Promise<number> => {
	if (!canRebirth(row.overallLevel)) {
		throw new HTTPException(409, { message: 'Rebirth not available' });
	}
	// Keeping your name is the only thing that displaces the old character: it
	// hands the name over and takes _old, osu!-style. Any other name leaves it
	// exactly as it was.
	const inherits = name === row.name;
	if (inherits) {
		const displaced = await displacedName(row.name);
		await db.insert(characterNameHistory).values({
			characterId: row.id, name: row.name,
		});
		await db.update(characters).set({ name: displaced }).where(eq(characters.id, row.id));
	} else {
		await assertNameAvailable(user.id, name, user.username);
	}

	const [created] = await db.insert(characters).values({
		userId: user.id, name, generation: row.generation + 1,
	});
	const characterId = created.insertId;

	await db.update(users)
		.set({ currentCharacter: characterId })
		.where(eq(users.id, user.id));

	await reindexCharacter(row.id);
	await reindexCharacter(characterId);

	// The account's sockets and its roster entry were both keyed by the character
	// that just gave up its place: without moving them, everything about the new
	// one's plays reaches nobody, and the player drops off the community overlay.
	hub.rekey(row.id, characterId);
	const [fresh] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, characterId))
		.limit(1);
	if (fresh) {
		await presenceRekey({
			fromId: row.id, character: fresh, user,
		});
	}
	return characterId;
};
