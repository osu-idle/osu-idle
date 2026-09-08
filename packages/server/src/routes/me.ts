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
import { db } from '../db/client';
import {
	characters,
	characterToDTO,
	type CharacterRow,
} from '../db/schema/character';
import { requireAuth } from '../auth/middleware';
import { users } from '../db/schema/user';
import { saveUploadedImage } from '../uploads';
import { env } from '../env';
import { publish } from '../discord/publish';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';
import { reindexCharacter } from '../rankings';
import { characterNameHistory } from '../db/schema/name_history';
import {
	prestigeBody,
	upgradeBody,
} from '@osu-idle/shared/upgrades';
import { rebirthBody } from '@osu-idle/shared/rebirth';
import { isPlaying } from '../play';
import {
	assertActionAvailable,
	performPrestige,
	performRebirth,
	performUpgrade,
} from '../character/actions';
import {
	applyPendingAction,
	queuePendingAction,
} from '../character/pending';
import { assertNameAvailable } from '../character/names';
import { announceCharacter } from '../character/push';
import type { PendingAction } from '@osu-idle/shared/pendingAction';
import type { UserRow } from '../db/schema/user';

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

		const dto = characterToDTO(row, user.avatarUrl, user.country);
		announceCharacter(dto);
		return c.json(dto);
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
	// Mid-play it is parked instead - see character/pending.ts.
	.post('/upgrade', requireAuth, jsonBody(upgradeBody), async c => {
		const { user, row } = await currentCharacter(c.get('userId'));
		const { skill } = c.req.valid('json');

		const deferred = await queueWhilePlaying(row, {
			type: 'upgrade', skill, requestedAt: Date.now(),
		});
		// parked, not refused: the client spends it locally now and the server
		// does it for real when the play ends
		if (deferred !== 'none') {
			return c.json({
				queued: deferred === 'queued',
				character: await characterById(row.id, user),
			});
		}

		const { spent, ratio } = await performUpgrade(row, skill);
		return c.json({
			character: await characterById(row.id, user), spent, ratio,
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
		const { user, row } = await currentCharacter(c.get('userId'));
		const { skill } = c.req.valid('json');

		const deferred = await queueWhilePlaying(row, {
			type: 'prestige', skill, requestedAt: Date.now(),
		});
		if (deferred === 'none') await performPrestige(row, skill);

		return c.json({
			queued: deferred === 'queued',
			character: await characterById(row.id, user),
		});
	})

	// Rebirth: the account starts a fresh character one generation up, which owns
	// one more unlock. The previous one stays playable, ranked, and keeps its
	// progress - it just gives up the name, osu!-style.
	.post('/rebirth', requireAuth, jsonBody(rebirthBody), async c => {
		const { user, row } = await currentCharacter(c.get('userId'));
		const { name } = c.req.valid('json');

		// Checked here, not only inside performRebirth: parked, that check would
		// not run until the play ended, where a taken name is a 403 swallowed into
		// a log - after the player was told the rebirth would happen. Keeping your
		// own name displaces the old character instead, so it needs no check.
		if (name !== row.name) await assertNameAvailable(user.id, name, user.username);

		const deferred = await queueWhilePlaying(row, {
			type: 'rebirth', name, requestedAt: Date.now(),
		});
		// nothing was created yet: the answer is the character they still have
		if (deferred === 'queued') {
			return c.json({
				queued: true, character: await characterById(row.id, user),
			});
		}
		// it already happened while we were parking it: answer with what it made,
		// or the client keeps the character the rebirth just renamed
		if (deferred === 'applied') {
			const { row: live } = await currentCharacter(user.id);
			return c.json({
				queued: false, character: await characterById(live.id, user),
			}, 201);
		}

		const created = await performRebirth(user, row, name);
		return c.json({
			queued: false, character: await characterById(created, user),
		}, 201);
	})

;

/** The character row as the wire sees it, re-read so it carries whatever the
 *  request just changed, and handed to the account's devices on the way out -
 *  the player's other screens are looking at the same character. */
const characterById = async (id: number, user: UserRow) => {
	const [row] = await db.select().from(characters).where(eq(characters.id, id)).limit(1);
	const dto = characterToDTO(row!, user.avatarUrl, user.country);
	announceCharacter(dto);
	return dto;
};

/**
 * Park an action when a play is running, and say whether it was parked.
 *
 * The play was simulated - outcome and xp both - from this character when it
 * started, so a purchase now can never reach it. Refusing outright would make
 * these unreachable for anyone actually using the play queue, so it waits for
 * the play to end instead. It is still checked against the character now, so an
 * impossible request fails immediately rather than silently later, and they
 * stack: buying three things during one play buys three things.
 */
const queueWhilePlaying = async (
	row: CharacterRow,
	action: PendingAction,
): Promise<'queued' | 'applied' | 'none'> => {
	if (!(await isPlaying(row.id))) return 'none';
	// checked against the character as it will be - what is already parked spends
	// first - and checked inside the lock that appends, so two clicks in the same
	// breath cannot both pass
	await queuePendingAction(row.id, action, (locked, parked) =>
		assertActionAvailable(locked, action, parked));

	// The play may have finished between the check above and the append, in which
	// case its finalise has already looked for parked actions and found none.
	// Nothing else would run this one until some later play ends - so it runs
	// here, and the caller answers with what happened rather than promising it
	// for an ending that is already past.
	if (await isPlaying(row.id)) return 'queued';
	await applyPendingAction(row.id);
	return 'applied';
};

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
	const dto = characterToDTO(row!, user.avatarUrl, user.country);
	announceCharacter(dto);
	return dto;
}
