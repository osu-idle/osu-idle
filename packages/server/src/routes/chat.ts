import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { DEFAULT_CHANNEL } from '@osu-idle/shared/community/wire';
import { requireAdmin } from '../auth/admin';
import { db } from '../db/client';
import { characters } from '../db/schema/character';
import { users } from '../db/schema/user';
import {
	adminAnnounce,
	characterOwner,
	chatChannels,
	chatHistory,
	deleteByCharacter,
	deleteMessages,
	handleChat,
	type ModerationStatus,
	moderationOf,
	nameColor,
	setBanned,
	timeoutUser,
	untimeoutUser,
} from '../ws/chat';

// Re-throw the ZodError so the app's onError returns the standard shape.
const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => {
		if (!result.success) throw result.error;
	});

const characterId = z.number().int().positive();

const historyQuery = z.object({ channel: z.string().optional() });

const messageBody = z.object({
	channel: z.string(),
	text: z.string().min(1),
});

/** One moderation action. Timeout / ban optionally delete the line that
 *  triggered them; delete / deleteDay clear messages directly. */
const moderateBody = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('timeout'),
		characterId,
		seconds: z.number().int().positive(),
		channel: z.string().optional(),
		messageId: z.string().optional(),
	}),
	z.object({
		action: z.literal('untimeout'), characterId,
	}),
	z.object({
		action: z.literal('ban'),
		characterId,
		channel: z.string().optional(),
		messageId: z.string().optional(),
	}),
	z.object({
		action: z.literal('unban'), characterId,
	}),
	z.object({
		action: z.literal('delete'),
		channel: z.string(),
		ids: z.array(z.string()).min(1),
	}),
	z.object({
		action: z.literal('deleteDay'), channel: z.string(), characterId,
	}),
]);

/** The signed-in admin's current character (to post as themselves). */
const adminCharacter = async (userId: number) => {
	const [row] = await db
		.select({
			id: characters.id, name: characters.name,
		})
		.from(characters)
		.innerJoin(users, eq(users.currentCharacter, characters.id))
		.where(eq(users.id, userId))
		.limit(1);
	return row;
};

/**
 * The admin chat console API: browse a channel's rolling-day history, post as
 * yourself (or `/announce`), and moderate (timeout / ban / delete). All gated by
 * `requireAdmin`. Live game clients are updated over the socket by `../ws/chat`.
 */
export const chatRoutes = new Hono()
	.get('/history', requireAdmin, zValidator('query', historyQuery, r => {
		if (!r.success) throw r.error;
	}), async c => {
		const channel = c.req.valid('query').channel ?? DEFAULT_CHANNEL;
		const messages = await chatHistory(channel);
		const senders = [...new Set(
			messages.flatMap(m => m.kind === 'player' ? [m.from.characterId] : []),
		)];
		const moderation: Record<number, ModerationStatus> = {};
		for (const cid of senders) {
			const userId = await characterOwner(cid);
			if (userId) moderation[cid] = await moderationOf(userId);
		}
		return c.json({
			channels: chatChannels(), channel, messages, moderation,
		});
	})
	.post('/message', requireAdmin, jsonBody(messageBody), async c => {
		const { channel, text } = c.req.valid('json');
		const prefix = '/announce ';
		if (text.startsWith(prefix)) {
			adminAnnounce(channel, text.slice(prefix.length).trim());
			return c.json({ ok: true });
		}
		const userId = c.get('userId');
		const character = await adminCharacter(userId);
		if (!character) throw new HTTPException(400, { message: 'No character to post as' });
		await handleChat({
			characterId: character.id, name: character.name, color: nameColor(userId),
		}, userId, channel, text, { bypassRate: true });
		return c.json({ ok: true });
	})
	.post('/moderate', requireAdmin, jsonBody(moderateBody), async c => {
		const body = c.req.valid('json');

		if (body.action === 'delete') {
			await deleteMessages(body.channel, body.ids);
			return c.json({ ok: true });
		}
		if (body.action === 'deleteDay') {
			await deleteByCharacter(body.channel, body.characterId);
			return c.json({ ok: true });
		}

		const userId = await characterOwner(body.characterId);
		if (!userId) throw new HTTPException(404, { message: 'Unknown character' });

		switch (body.action) {
			case 'timeout':
				await timeoutUser(userId, body.seconds);
				if (body.channel && body.messageId) await deleteMessages(body.channel, [body.messageId]);
				break;
			case 'untimeout':
				await untimeoutUser(userId);
				break;
			case 'ban':
				await setBanned(userId, true);
				if (body.channel && body.messageId) await deleteMessages(body.channel, [body.messageId]);
				break;
			case 'unban':
				await setBanned(userId, false);
				break;
		}
		return c.json({ ok: true });
	})
;
