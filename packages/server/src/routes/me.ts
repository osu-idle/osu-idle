import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { onboardingBody } from '@osu-idle/shared/onboarding';
import {
	db,
	farmPool,
	statsPool,
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

		const [existingName] = await db
			.select({ name: characters.name })
			.from(characters)
			.where(eq(characters.name, body.name))
			.limit(1);
		if (existingName) throw new HTTPException(409, { message: 'Name already taken' });

		const [results1] = await statsPool.promise().query<RowDataPacket[]>(
			'SELECT * FROM osu_user WHERE osu_id != ? AND username = ?', 
			[userId, body.name]);
		const [results2] = await farmPool.promise().query<RowDataPacket[]>(
			'SELECT * FROM user WHERE osu_id != ? AND username = ?', 
			[userId, body.name]);

		if ((results1 && results1.length) || (results2 && results2.length)) {
			throw new HTTPException(403, { message: 'Name is reserved' });
		}

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
;

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
