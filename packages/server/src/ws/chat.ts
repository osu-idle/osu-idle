import {
	DEFAULT_CHANNEL,
	MAX_CHAT_LENGTH,
	type ChatLine,
} from '@osu-idle/shared/community/wire';
import { redis } from '../redis';
import { redisKeyPrefix } from '../env';
import { hub } from './hub';

/**
 * The chat relay. One channel for now (`#osu!idle`); messages are pure fan-out
 * with **no persistence** - a line lives only in flight, so a client sees only
 * what was sent after it connected. A small per-character rate limit keeps a
 * single client from flooding the room.
 */

// Channels a client may post to. Extend as DMs / more rooms land.
const CHANNELS = new Set([DEFAULT_CHANNEL]);

// Fixed-window rate limit: at most BURST messages per WINDOW per character.
const WINDOW_MS = 5 * 1000;
const BURST = 5;

const rateLimited = async (characterId: number): Promise<boolean> => {
	const key = `${redisKeyPrefix}chat:rl:${characterId}`;
	const count = await redis.incr(key);
	if (count === 1) await redis.pexpire(key, WINDOW_MS);
	return count > BURST;
};

/** Validate, rate-limit and relay one chat line. Errors go back to the sender only. */
export const handleChat = async (
	from: { characterId: number; name: string; color: string },
	channel: string,
	text: string,
): Promise<void> => {
	const trimmed = text.trim();
	if (!trimmed) return;

	if (!CHANNELS.has(channel)) {
		hub.sendTo(from.characterId, {
			type: 'error', message: `Unknown channel: ${channel}`,
		});
		return;
	}

	if (await rateLimited(from.characterId)) {
		hub.sendTo(from.characterId, {
			type: 'error', message: 'You are sending messages too fast.',
		});
		return;
	}

	const line: ChatLine = {
		kind: 'player',
		channel,
		from,
		text: trimmed.slice(0, MAX_CHAT_LENGTH),
		at: Date.now(),
	};

	hub.broadcast({
		type: 'chat',
		line,
	});
};

/** Broadcast a server announcement (no sender) - e.g. a #1-rank notice. The
 *  whole line renders in `color`. */
export const announce = (channel: string, text: string, color: string): void => {
	hub.broadcast({
		type: 'chat',
		line: {
			kind: 'system',
			channel,
			text: text.slice(0, MAX_CHAT_LENGTH),
			color,
			at: Date.now(),
		},
	});
};
