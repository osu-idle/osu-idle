import {
	type PresenceEntry,
	type Status,
	STATUS,
} from '@osu-idle/shared/community/presence';
import { redis } from '../redis';
import { redisKeyPrefix } from '../env';
import {
	type CharacterRow,
	resolveAvatarUrl,
} from '../db/schema/character';
import type { UserRow } from '../db/schema/user';
import { getCharacterTotals } from '../db/schema/character_totals';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import { globalRank } from '../rankings';
import type { GeoResult } from '../geo';
import { hub } from './hub';

/**
 * The live roster behind the community overlay. Each open WebSocket adds one
 * entry; the entry carries everything a player card / world-map dot needs. Stored
 * in Redis (shared across the cluster) as a hash keyed by character, with a
 * companion sorted set of last-seen times so a worker crash can't leak a ghost -
 * the sweep prunes anyone who stopped refreshing.
 */

const PRESENCE_KEY = `${redisKeyPrefix}presence`;
const SEEN_KEY = `${redisKeyPrefix}presence:seen`;

/** A presence entry whose last-seen wasn't refreshed within this window is swept. */
const PRESENCE_TTL = 90 * 1000;

const buildEntry = async (params: {
	character: CharacterRow;
	user: UserRow;
	geo: GeoResult;
	status: Status;
}): Promise<PresenceEntry> => {
	const { character, user, geo, status } = params;
	const totals = await getCharacterTotals(character.id);
	return {
		characterId: character.id,
		name: character.name,
		avatarUrl: resolveAvatarUrl(character.avatarUrl, user.avatarUrl),
		country: user.country,
		rank: await globalRank('pp', character.id),
		pp: Number(character.pp),
		accuracy: hitAccuracy(totals),
		playCount: totals.playCount,
		level: character.overallLevel,
		status,
		loc: geo.loc,
		tz: geo.tz,
	};
};

const store = (entry: PresenceEntry): Promise<unknown> =>
	redis.multi()
		.hset(PRESENCE_KEY, String(entry.characterId), JSON.stringify(entry))
		.zadd(SEEN_KEY, Date.now(), String(entry.characterId))
		.exec();

const readEntry = async (characterId: number): Promise<PresenceEntry | undefined> => {
	const v = await redis.hget(PRESENCE_KEY, String(characterId));
	return v ? JSON.parse(v) as PresenceEntry : undefined;
};

/** Live count of connected players. */
export const presenceCount = (): Promise<number> => redis.hlen(PRESENCE_KEY);

/** Every connected player (the snapshot a freshly connected client receives). */
export const presenceSnapshot = async (): Promise<PresenceEntry[]> => {
	const all = await redis.hvals(PRESENCE_KEY);
	return all.map(v => JSON.parse(v) as PresenceEntry);
};

const broadcastOnline = async (): Promise<void> =>
	hub.broadcast({
		type: 'online', count: await presenceCount(),
	});

/** Register a newly connected player and announce them. */
export const join = async (params: {
	character: CharacterRow;
	user: UserRow;
	geo: GeoResult;
}): Promise<PresenceEntry> => {
	const entry = await buildEntry({
		...params, status: STATUS.idle,
	});
	await store(entry);
	hub.broadcast({
		type: 'presence:add', entry,
	});
	await broadcastOnline();
	return entry;
};

/** Drop a disconnected player and announce it. */
export const leave = async (characterId: number): Promise<void> => {
	await redis.multi()
		.hdel(PRESENCE_KEY, String(characterId))
		.zrem(SEEN_KEY, String(characterId))
		.exec();
	hub.broadcast({
		type: 'presence:remove', characterId,
	});
	await broadcastOnline();
};

/** Refresh a player's last-seen so the sweep doesn't prune them. */
export const touch = (characterId: number): Promise<number> =>
	redis.zadd(SEEN_KEY, Date.now(), String(characterId));

/** Patch a connected player's entry (status / now-playing) and announce it. No-op
 *  if they have no live entry (e.g. a play whose client never opened a socket). */
export const update = async (
	characterId: number,
	patch: Partial<Pick<PresenceEntry, 'status' | 'nowPlaying'>>,
): Promise<void> => {
	const entry = await readEntry(characterId);
	if (!entry) return;
	const next = {
		...entry, ...patch,
	};
	await redis.hset(PRESENCE_KEY, String(characterId), JSON.stringify(next));
	hub.broadcast({
		type: 'presence:update', entry: next,
	});
};

/** Prune entries whose last-seen has expired (a worker died without a clean
 *  close). Runs periodically on every worker; the deletes are idempotent. */
export const sweepPresence = async (): Promise<void> => {
	const cutoff = Date.now() - PRESENCE_TTL;
	const stale = await redis.zrangebyscore(SEEN_KEY, '-inf', cutoff);
	for (const id of stale) await leave(Number(id));
};
