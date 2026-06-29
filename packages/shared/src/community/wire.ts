import { z } from 'zod';
import {
	values,
	type ValueIn,
} from '../helpers/mapped.js';
import {
	CLIENT_STATUS,
	presenceEntryDTO,
} from './presence.js';

/** The default channel every signed-in player joins. */
export const DEFAULT_CHANNEL = '#osu!idle';

/** Server-enforced cap on a chat line. */
export const MAX_CHAT_LENGTH = 2000;

const chatLineBase = {
	channel: z.string(),
	text: z.string(),
	at: z.number().int(), // epoch ms
};

/** One chat line as it travels to clients. No persistence: a line exists only
 *  in flight, so a freshly connected socket sees only lines sent after it joins.
 *  `player` lines are someone typing (coloured username); `system` lines are
 *  server announcements (the whole text is coloured, no sender). */
export const chatLineDTO = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('player'),
		...chatLineBase,
		from: z.object({
			characterId: z.number().int().positive(),
			name: z.string(),
			color: z.string(),
		}),
	}),
	z.object({
		kind: z.literal('system'),
		...chatLineBase,
		color: z.string(),
	}),
]);
export type ChatLine = z.infer<typeof chatLineDTO>;

/**
 * Client -> server. A topic-tagged envelope so new features add a variant rather
 * than a second socket. Today: chat, self status, channel (un)subscribe.
 */
export const clientMessage = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('chat'),
		channel: z.string(),
		text: z.string().min(1).max(MAX_CHAT_LENGTH),
	}),
	z.object({
		type: z.literal('status'),
		status: z.enum(values(CLIENT_STATUS)),
	}),
	z.object({
		type: z.literal('subscribe'),
		channel: z.string(),
	}),
	z.object({
		type: z.literal('unsubscribe'),
		channel: z.string(),
	}),
]);
export type ClientMessage = z.infer<typeof clientMessage>;
export type ClientMessageType = ValueIn<{ [M in ClientMessage as M['type']]: M['type'] }>;

/**
 * Server -> client. Presence is delivered as a snapshot (`presence:init`) then
 * deltas; chat and the online count are pushed as they change.
 */
export const serverMessage = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('presence:init'),
		entries: z.array(presenceEntryDTO),
	}),
	z.object({
		type: z.literal('presence:add'),
		entry: presenceEntryDTO,
	}),
	z.object({
		type: z.literal('presence:update'),
		entry: presenceEntryDTO,
	}),
	z.object({
		type: z.literal('presence:remove'),
		characterId: z.number().int().positive(),
	}),
	z.object({
		type: z.literal('chat'),
		line: chatLineDTO,
	}),
	z.object({
		type: z.literal('online'),
		count: z.number().int().min(0),
	}),
	z.object({
		type: z.literal('error'),
		message: z.string(),
	}),
]);
export type ServerMessage = z.infer<typeof serverMessage>;
