import {
	DEFAULT_CHANNEL,
	MAX_CHAT_LENGTH,
	type ChatLine,
} from '@osu-idle/shared/community/wire';
import { isAdmin } from '@osu-idle/shared/admin';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { redis } from '../redis';
import { redisKeyPrefix } from '../env';
import { db } from '../db/client';
import { characters } from '../db/schema/character';
import { hub } from './hub';

/**
 * The chat relay + its moderation surface. Messages fan out over the socket and
 * are also kept in Redis for a rolling day (per channel: a hash id->line plus a
 * last-seen ZSET for ordering + trim) so the admin console can show history and
 * target a line for deletion. Bans (a Redis set) and timeouts (TTL keys) gate
 * who may post; a delete rewrites the stored line and pushes `chat:delete` so
 * every connected client blanks it live.
 */

// Channels a client may post to / the console may browse. Extend as more land.
const CHANNELS = new Set([DEFAULT_CHANNEL]);

/** The browsable channel list (for the admin console). */
export const chatChannels = (): string[] => [...CHANNELS];

// Fixed-window rate limit: at most BURST messages per WINDOW per character.
const WINDOW_MS = 5 * 1000;
const BURST = 5;

// History is a rolling 1-day window, per channel.
const HISTORY_MS = 24 * 60 * 60 * 1000;
const logKey = (channel: string): string => `${redisKeyPrefix}chat:log:${channel}`;
const idxKey = (channel: string): string => `${redisKeyPrefix}chat:idx:${channel}`;

// Moderation state. Bans persist until lifted; timeouts auto-expire via TTL.
const BAN_KEY = `${redisKeyPrefix}chat:banned`;
const timeoutKey = (userId: number): string => `${redisKeyPrefix}chat:timeout:${userId}`;

/** Chat username colours: a soft yellow for players, purple for admins. */
export const PLAYER_NAME_COLOR = '#fff09a';
export const ADMIN_NAME_COLOR = '#b06cff';
/** `/announce` renders the whole line in this attention-grabbing red. */
const ANNOUNCE_COLOR = '#ff6b6b';
/** A deleted line's text is replaced with this, in history and live. */
const DELETED_TEXT = '<deleted>';

export const nameColor = (userId: number): string =>
	isAdmin(userId) ? ADMIN_NAME_COLOR : PLAYER_NAME_COLOR;

const rateLimited = async (characterId: number): Promise<boolean> => {
	const key = `${redisKeyPrefix}chat:rl:${characterId}`;
	const count = await redis.incr(key);
	if (count === 1) await redis.pexpire(key, WINDOW_MS);
	return count > BURST;
};

/** The user that owns a character (to key moderation off a message's sender). */
export const characterOwner = async (characterId: number): Promise<number | undefined> => {
	const [row] = await db
		.select({ userId: characters.userId })
		.from(characters)
		.where(eq(characters.id, characterId))
		.limit(1);
	return row?.userId;
};

// --- history ---

/** Append a line and trim anything older than the rolling window. */
const store = async (channel: string, line: ChatLine): Promise<void> => {
	const stale = await redis.zrangebyscore(idxKey(channel), '-inf', Date.now() - HISTORY_MS);
	const tx = redis.multi()
		.hset(logKey(channel), line.id, JSON.stringify(line))
		.zadd(idxKey(channel), line.at, line.id);
	if (stale.length) tx.hdel(logKey(channel), ...stale).zrem(idxKey(channel), ...stale);
	await tx.exec();
};

/** Every retained line in a channel, oldest first. */
export const chatHistory = async (channel: string): Promise<ChatLine[]> => {
	const ids = await redis.zrangebyscore(idxKey(channel), Date.now() - HISTORY_MS, '+inf');
	if (!ids.length) return [];
	const raw = await redis.hmget(logKey(channel), ...ids);
	return raw.filter((v): v is string => !!v).map(v => JSON.parse(v) as ChatLine);
};

// --- moderation ---

export const isBanned = async (userId: number): Promise<boolean> =>
	(await redis.sismember(BAN_KEY, String(userId))) === 1;

const isTimedOut = async (userId: number): Promise<boolean> =>
	(await redis.exists(timeoutKey(userId))) === 1;

/** Banned or currently timed out - may not post. */
export const isMuted = async (userId: number): Promise<boolean> =>
	(await isBanned(userId)) || (await isTimedOut(userId));

export const setBanned = async (userId: number, banned: boolean): Promise<void> => {
	if (banned) await redis.sadd(BAN_KEY, String(userId));
	else await redis.srem(BAN_KEY, String(userId));
};

/** Mute a user for `seconds` (auto-clears when the TTL lapses). */
export const timeoutUser = async (userId: number, seconds: number): Promise<void> => {
	const ms = Math.max(1, Math.floor(seconds)) * 1000;
	await redis.set(timeoutKey(userId), Date.now() + ms, 'PX', ms);
};

export const untimeoutUser = async (userId: number): Promise<void> => {
	await redis.del(timeoutKey(userId));
};

export type ModerationStatus = { banned: boolean; timeoutUntil?: number };

/** Current moderation state for the console. */
export const moderationOf = async (userId: number): Promise<ModerationStatus> => {
	const until = await redis.get(timeoutKey(userId));
	return {
		banned: await isBanned(userId),
		timeoutUntil: until ? Number(until) : undefined,
	};
};

// --- posting ---

/** Validate, gate (mute + rate limit) and relay one chat line, storing it in
 *  history. Errors go back to the sender only. `bypassRate` is for admin sends. */
export const handleChat = async (
	from: { characterId: number; name: string; color: string },
	userId: number,
	channel: string,
	text: string,
	opts?: { bypassRate?: boolean },
): Promise<void> => {
	const trimmed = text.trim();
	if (!trimmed) return;

	if (!CHANNELS.has(channel)) {
		hub.sendTo(from.characterId, {
			type: 'error', message: `Unknown channel: ${channel}`,
		});
		return;
	}

	if (await isMuted(userId)) {
		hub.sendTo(from.characterId, {
			type: 'error', message: 'You cannot post to chat right now.',
		});
		return;
	}

	if (!opts?.bypassRate && await rateLimited(from.characterId)) {
		hub.sendTo(from.characterId, {
			type: 'error', message: 'You are sending messages too fast.',
		});
		return;
	}

	const line: ChatLine = {
		id: randomUUID(),
		kind: 'player',
		channel,
		from,
		text: trimmed.slice(0, MAX_CHAT_LENGTH),
		at: Date.now(),
	};

	await store(channel, line);
	hub.broadcast({
		type: 'chat', line,
	});
};

/** Broadcast a server announcement (no sender) - e.g. a #1-rank notice. The
 *  whole line renders in `color`. Fire-and-forget history write. */
export const announce = (channel: string, text: string, color: string): void => {
	const line: ChatLine = {
		id: randomUUID(),
		kind: 'system',
		channel,
		text: text.slice(0, MAX_CHAT_LENGTH),
		color,
		at: Date.now(),
	};
	void store(channel, line);
	hub.broadcast({
		type: 'chat', line,
	});
};

/** An admin `/announce`: a system line in the attention colour. */
export const adminAnnounce = (channel: string, text: string): void =>
	announce(channel, text, ANNOUNCE_COLOR);

// --- deletion ---

/** Blank the given lines in history and tell every client to do the same. */
export const deleteMessages = async (channel: string, ids: string[]): Promise<string[]> => {
	if (!ids.length) return [];
	const raw = await redis.hmget(logKey(channel), ...ids);
	const tx = redis.multi();
	const deleted: string[] = [];
	for (const v of raw) {
		if (!v) continue;
		const line = {
			...JSON.parse(v) as ChatLine, text: DELETED_TEXT,
		};
		tx.hset(logKey(channel), line.id, JSON.stringify(line));
		deleted.push(line.id);
	}
	if (!deleted.length) return [];
	await tx.exec();
	hub.broadcast({
		type: 'chat:delete', channel, ids: deleted,
	});
	return deleted;
};

/** Delete every retained line a character posted in a channel (their "day"). */
export const deleteByCharacter = async (
	channel: string,
	characterId: number,
): Promise<string[]> => {
	const lines = await chatHistory(channel);
	const ids = lines
		.filter(l => l.kind === 'player' && l.from.characterId === characterId)
		.map(l => l.id);
	return deleteMessages(channel, ids);
};
