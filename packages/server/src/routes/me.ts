import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
	and,
	eq,
} from 'drizzle-orm';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import {
	characterNameBody,
	onboardingBody,
} from '@osu-idle/shared/onboarding';
import {
	db,
	pool,
} from '../db/client';
import {
	characters,
	characterToDTO,
} from '../db/schema/character';
import { requireAuth } from '../auth/middleware';
import { users } from '../db/schema/user';
import { saveUploadedImage } from '../uploads';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../env';
import { publish } from '../discord/publish';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';
import { reindexCharacter } from '../rankings';
import { characterNameHistory } from '../db/schema/name_history';
import {
	applyPrestige,
	applyUpgrade,
	canPrestige,
	canRebirth,
	canUpgrade,
	prestigeBody,
	upgradeBody,
} from '@osu-idle/shared/upgrades';
import {
	OLD_SUFFIX,
	rebirthBody,
	usesReservedOld,
} from '@osu-idle/shared/rebirth';
import { isPlaying } from '../play';
import { resetMemory } from '../db/schema/beatmaps_played';
import { SKILL } from '@osu-idle/shared/skills';
import { xpGivesLevel } from '@osu-idle/shared/sim/skills/xp';
import type { SkillName } from '@osu-idle/shared/skills';

const characterId = z.number().int().positive();
const characterRenameBody = characterNameBody.extend({ characterId: characterId.optional() });

const characterSelectBody = z.object({ characterId });

// Re-throw the ZodError so the app's onError returns the standard shape.
const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => {
		if (!result.success) throw result.error;
	});

/** The signed-in account's own character (created during first-login onboarding). */
export const meRoutes = new Hono()
	// The account's character, or null when onboarding is still needed.
	.get('/character', requireAuth, async c => {
		const [row] = await db
			.select()
			.from(characters)
			.innerJoin(users, eq(users.currentCharacter, characters.id))
			.where(eq(users.id, c.get('userId')))
			.limit(1);
		return c.json(row ? characterToDTO(row.character, row.user.avatarUrl, row.user.country) : null);
	})

	// Onboarding: create the account's character once, always fresh.
	.post('/character', requireAuth, async c => {
		const userId = c.get('userId');
		const body = onboardingBody.parse(await c.req.json());

		const [user] = await db.select().from(users).where(eq(users.id, userId));
		if (!user) throw new HTTPException(404, { message: 'User not found' });

		const [existing] = await db
			.select({ id: characters.id })
			.from(characters)
			.where(eq(characters.userId, userId))
			.limit(1);
		if (existing) throw new HTTPException(409, { message: 'Character already exists' });

		await assertNameAvailable(userId, body.name, user.username);

		// Always a fresh character - skill/profile columns default to zero, and
		// local Guest progress is no longer migrated online.
		const [created] = await db.insert(characters).values({
			userId, name: body.name, 
		});
		const characterId = created.insertId;

		await db.update(users)
			.set({ currentCharacter: characterId })
			.where(eq(users.id, userId));

		await reindexCharacter(characterId);

		const [row] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);

		void publish(env.USER_FEED_WEBHOOK, {
			embeds: [{
				title: `Welcome ${row.name} to osu!idle !`,
				url: `https://osu.idle.rhythmgamers.net/web/c/${row.id}`,
				fields: [
					{
						name: `osu! user: ${user.username}`,
						value: `(see profile)[https://osu.ppy.sh/users/${user.id}]`,
					},
				],
				thumbnail: {
					url: row.avatarUrl ?? user.avatarUrl ?? GUEST_AVATAR_URL,
					placeholder: GUEST_AVATAR_URL,
				},
			}],
		});

		return c.json(characterToDTO(row!, user.avatarUrl, user.country), 201);
	})

	// Rename the account's current character (same rules as creation). The old
	// name is kept permanently in the character's name history.
	.post('/username', requireAuth, jsonBody(characterRenameBody), async c => {
		const userId = c.get('userId');
		const {
			name, characterId,
		} = c.req.valid('json');

		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		const target = characterId ?? user?.currentCharacter;
		if (!user || !target) throw new HTTPException(409, { message: 'No character' });

		const [row] = await db
			.select()
			.from(characters)
			.where(and(eq(characters.id, target), eq(characters.userId, userId)))
			.limit(1);
		if (!row) throw new HTTPException(409, { message: 'No character' });

		if (name !== row.name) {
			await assertNameAvailable(userId, name, user.username, row.id);
			await db.insert(characterNameHistory).values({
				characterId: row.id, name: row.name,
			});
			await db.update(characters).set({ name }).where(eq(characters.id, row.id));
			row.name = name;
		}

		return c.json(characterToDTO(row, user.avatarUrl, user.country));
	})

	// Upload a custom profile picture for the account's current character,
	// overriding its osu! avatar. Returns the updated character.
	.post('/avatar', requireAuth, async c => {
		const body = await c.req.parseBody();
		const url = await saveUploadedImage(body['file']);
		return c.json(await setCurrentCharacterAvatar(c.get('userId'), url));
	})

	// Remove the custom profile picture, reverting to the osu! avatar.
	.delete('/avatar', requireAuth, async c => {
		return c.json(await setCurrentCharacterAvatar(c.get('userId'), null));
	})

	// Buy the current character's next upgrade for a skill: spends levels
	// (and their lifetime XP, so leaderboards drop too) per the shared math.
	.post('/upgrade', requireAuth, jsonBody(upgradeBody), async c => {
		const userId = c.get('userId');
		const { skill } = c.req.valid('json');

		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user?.currentCharacter) throw new HTTPException(409, { message: 'No character' });

		const [row] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, user.currentCharacter))
			.limit(1);
		if (!row) throw new HTTPException(409, { message: 'No character' });

		const state = {
			level: row[`${skill}Level`],
			xp: row[`${skill}Xp`],
			upgrades: row[`${skill}Upgrades`],
			overdrive: row[`${skill}Overdrive`],
			prestige: row[`${skill}Prestige`],
		};
		if (!canUpgrade(state)) throw new HTTPException(409, { message: 'Upgrade not purchasable' });
		const purchase = applyUpgrade(state);

		// Spending is global: the spent XP also leaves the lifetime totals that
		// rankings and the overall level are built on.
		const spent = Math.round(purchase.spent);
		const skillTotalXp = Math.max(0, row[`${skill}TotalXp`] - spent);
		const overallTotalXp = Math.max(0, row.overallTotalXp - spent);
		const overall = xpGivesLevel(overallTotalXp);

		const updates = {
			[`${skill}Level`]: purchase.level,
			[`${skill}Xp`]: Math.round(purchase.xp),
			[`${skill}TotalXp`]: skillTotalXp,
			[`${skill}Upgrades`]: purchase.upgrades,
			[`${skill}Overdrive`]: purchase.overdrive,
			overallTotalXp,
			overallLevel: overall.level,
			overallXp: Math.round(overall.xp),
		} as Record<`${SkillName}${'Level' | 'Xp' | 'TotalXp' | 'Upgrades' | 'Overdrive'}`
		| `overall${'Level' | 'Xp' | 'TotalXp'}`, number>;

		// Conditional write: lose the race against a concurrent purchase or a
		// play finalise touching the same skill, instead of clobbering it.
		const [written] = await db
			.update(characters)
			.set(updates)
			.where(and(
				eq(characters.id, row.id),
				eq(characters[`${skill}Level`], state.level),
				eq(characters[`${skill}Upgrades`], state.upgrades),
			));
		if (!written.affectedRows) throw new HTTPException(409, { message: 'Character changed, retry' });

		await reindexCharacter(row.id);

		const [updated] = await db
			.select()
			.from(characters)
			.where(eq(characters.id, row.id))
			.limit(1);

		return c.json({
			character: characterToDTO(updated!, user.avatarUrl, user.country),
			spent,
			ratio: purchase.ratio,
		});
	})

	// Every character the account owns, oldest generation first - the hall of fame.
	.get('/characters', requireAuth, async c => {
		const userId = c.get('userId');
		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user) throw new HTTPException(404, { message: 'User not found' });

		const rows = await db
			.select()
			.from(characters)
			.where(eq(characters.userId, userId))
			.orderBy(characters.generation);

		return c.json(rows.map(row => characterToDTO(row, user.avatarUrl, user.country)));
	})

	// Switch which of the account's characters is live.
	.post('/character/select', requireAuth, jsonBody(characterSelectBody), async c => {
		const userId = c.get('userId');
		const { characterId } = c.req.valid('json');

		const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		if (!user) throw new HTTPException(404, { message: 'User not found' });

		const [row] = await db
			.select()
			.from(characters)
			.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
			.limit(1);
		if (!row) throw new HTTPException(404, { message: 'Character not found' });

		if (user.currentCharacter) await assertNotPlaying(user.currentCharacter);

		await db.update(users)
			.set({ currentCharacter: characterId })
			.where(eq(users.id, userId));

		return c.json(characterToDTO(row, user.avatarUrl, user.country));
	})

	// Prestige one skill: its level, xp, upgrades and overdrive go, and it keeps a
	// bonus level, an extra gear tier and a bigger multiplier. Lifetime totals and
	// the ranking metrics are deliberately left alone.
	.post('/prestige', requireAuth, jsonBody(prestigeBody), async c => {
		const userId = c.get('userId');
		const { skill } = c.req.valid('json');
		const { user, row } = await currentCharacter(userId);
		await assertNotPlaying(row.id);

		const state = {
			level: row[`${skill}Level`],
			xp: row[`${skill}Xp`],
			upgrades: row[`${skill}Upgrades`],
			overdrive: row[`${skill}Overdrive`],
			prestige: row[`${skill}Prestige`],
		};
		if (!canPrestige(state)) throw new HTTPException(409, { message: 'Prestige not available' });
		const next = applyPrestige(state);

		const updates = {
			[`${skill}Level`]: next.level,
			[`${skill}Xp`]: next.xp,
			[`${skill}Upgrades`]: next.upgrades,
			[`${skill}Overdrive`]: next.overdrive,
			[`${skill}Prestige`]: next.prestige,
		} as Record<`${SkillName}${'Level' | 'Xp' | 'Upgrades' | 'Overdrive' | 'Prestige'}`, number>;

		const [written] = await db
			.update(characters)
			.set(updates)
			.where(and(
				eq(characters.id, row.id),
				eq(characters[`${skill}Level`], state.level),
				eq(characters[`${skill}Prestige`], state.prestige),
			));
		if (!written.affectedRows) throw new HTTPException(409, { message: 'Character changed, retry' });

		// memory's progress is the maps it has learned, so that is what its
		// prestige spends - the play counts the profile shows are left alone
		if (skill === SKILL.memory) await resetMemory(row.id);

		await reindexCharacter(row.id);

		const [updated] = await db.select().from(characters).where(eq(characters.id, row.id)).limit(1);
		return c.json(characterToDTO(updated!, user.avatarUrl, user.country));
	})

	// Rebirth: the account starts a fresh character one generation up, which owns
	// one more unlock. The previous one stays playable, ranked, and keeps its
	// progress - it just gives up the name, osu!-style.
	.post('/rebirth', requireAuth, jsonBody(rebirthBody), async c => {
		const userId = c.get('userId');
		const { name } = c.req.valid('json');
		const { user, row } = await currentCharacter(userId);
		await assertNotPlaying(row.id);

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
			await assertNameAvailable(userId, name, user.username);
		}

		const [created] = await db.insert(characters).values({
			userId, name, generation: row.generation + 1,
		});
		const characterId = created.insertId;

		await db.update(users)
			.set({ currentCharacter: characterId })
			.where(eq(users.id, userId));

		await reindexCharacter(row.id);
		await reindexCharacter(characterId);

		const [fresh] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
		return c.json(characterToDTO(fresh!, user.avatarUrl, user.country), 201);
	})
;

/** The account's live character, or a 409 when onboarding never ran. */
const currentCharacter = async (userId: number) => {
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user?.currentCharacter) throw new HTTPException(409, { message: 'No character' });

	const [row] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, user.currentCharacter))
		.limit(1);
	if (!row) throw new HTTPException(409, { message: 'No character' });

	return {
		user, row,
	};
};

/** A running play reads the character mid-flight, so anything that rewrites its
 *  progression waits for the play to end. */
const assertNotPlaying = async (characterId: number) => {
	if (await isPlaying(characterId)) {
		throw new HTTPException(409, { message: 'A play is in progress' });
	}
};

/** The name a displaced character falls back to, osu!-style: append _old until
 *  it is free, so a lineage chains Adri -> Adri_old -> Adri_old_old. */
const displacedName = async (name: string): Promise<string> => {
	let candidate = `${name}${OLD_SUFFIX}`;
	for (;;) {
		const [taken] = await db
			.select({ id: characters.id })
			.from(characters)
			.where(eq(characters.name, candidate))
			.limit(1);
		if (!taken) return candidate;
		candidate = `${candidate}${OLD_SUFFIX}`;
	}
};

/** Reject a name already used by another character (`excludeCharacterId` is the
 *  caller's own, for renames), reserved by another osu! account, or carrying the
 *  _old token, which only a player whose own osu! username has it may use. */
const assertNameAvailable = async (
	userId: number,
	name: string,
	osuUsername: string,
	excludeCharacterId?: number,
) => {
	if (usesReservedOld(name, osuUsername)) {
		throw new HTTPException(403, { message: 'Name is reserved' });
	}

	const [existingName] = await db
		.select({ id: characters.id })
		.from(characters)
		.where(eq(characters.name, name))
		.limit(1);
	if (existingName && existingName.id !== excludeCharacterId) {
		throw new HTTPException(409, { message: 'Name already taken' });
	}

	const [results1] = await pool.promise().query<RowDataPacket[]>(
		'SELECT * FROM stats.osu_user WHERE osu_id != ? AND username = ?',
		[userId, name]);
	const [results2] = await pool.promise().query<RowDataPacket[]>(
		'SELECT * FROM farm.user WHERE osu_id != ? AND username = ?',
		[userId, name]);

	if ((results1 && results1.length) || (results2 && results2.length)) {
		throw new HTTPException(403, { message: 'Name is reserved' });
	}
};

/** Set the account's current character avatar and return the resolved character DTO. */
async function setCurrentCharacterAvatar(userId: number, url: string | null) {
	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	if (!user?.currentCharacter) throw new HTTPException(409, { message: 'No character' });

	await db.update(characters).set({ avatarUrl: url }).where(eq(characters.id, user.currentCharacter));
	const [row] = await db
		.select()
		.from(characters)
		.where(eq(characters.id, user.currentCharacter))
		.limit(1);
	return characterToDTO(row!, user.avatarUrl, user.country);
}
