import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq } from 'drizzle-orm';
import { onboardingBody } from '@osu-idle/shared/onboarding';
import { db, farmPool, statsPool } from '../db/client';
import { characters, characterToDTO } from '../db/schema/character';
import { requireAuth } from '../auth/middleware';
import { users, toUserDTO } from '../db/schema/user';
import { saveUploadedImage } from '../uploads';
import type { RowDataPacket } from 'mysql2/promise';

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
		return c.json(row ? characterToDTO(row.character) : null);
	})

	// Onboarding: create the account's character once, always fresh.
	.post('/character', requireAuth, async c => {
		const userId = c.get('userId');
		const body = onboardingBody.parse(await c.req.json());

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

		const [results1] = await statsPool.promise().query<RowDataPacket[]>('SELECT * FROM osu_user WHERE osu_id != ? AND username = ?', [userId, body.name]);
		console.log(userId, body.name, results1);
		const [results2] = await farmPool.promise().query<RowDataPacket[]>('SELECT * FROM user WHERE osu_id != ? AND username = ?', [userId, body.name]);
		console.log(userId, body.name, results2);

		if ((results1 && results1.length) || (results2 && results2.length)) {
			throw new HTTPException(403, { message: 'Name is reserved' });
		}

		// Always a fresh character - skill/profile columns default to zero, and
		// local Guest progress is no longer migrated online.
		const [created] = await db.insert(characters).values({ userId, name: body.name });
		const characterId = created.insertId;

		await db.update(users)
			.set({ currentCharacter: characterId })
			.where(eq(users.id, userId));

		const [row] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
		return c.json(characterToDTO(row!), 201);
	})

	// Upload a custom profile picture, overriding the osu! avatar. Returns the
	// updated user so the client can refresh its session view immediately.
	.post('/avatar', requireAuth, async c => {
		const body = await c.req.parseBody();
		const url = await saveUploadedImage(body['file']);
		const userId = c.get('userId');
		await db.update(users).set({ customAvatarUrl: url }).where(eq(users.id, userId));
		const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		return c.json(toUserDTO(row!));
	})

	// Remove the custom profile picture, reverting to the osu! avatar.
	.delete('/avatar', requireAuth, async c => {
		const userId = c.get('userId');
		await db.update(users).set({ customAvatarUrl: null }).where(eq(users.id, userId));
		const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
		return c.json(toUserDTO(row!));
	})
;
