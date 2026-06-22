import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { Skills, type SkillName } from '@osu-idle/shared/skills';
import { redis } from './redis';
import { db } from './db/client';
import { characters } from './db/schema/character';
import { character_totals } from './db/schema/character_totals';
import { users } from './db/schema/user';
import { best } from './db/schema/best';
import { redisKeyPrefix } from './env';
import { GoodGrades, type GoodGrade } from '@osu-idle/shared/judgement';

/**
 * Player rankings, kept in Redis sorted sets instead of recomputed on every
 * fetch. MySQL stays the source of truth; these sets are a derived index that
 * answers the two hot questions in O(log N):
 *
 *  - rank of one character    -> ZREVRANK   (the profile page: global/country/
 *                                            score/overall + best-skill rank)
 *  - a leaderboard page       -> ZREVRANGE  (the ranking listings)
 *
 * One member per character per set, scored by the metric. A score change is a
 * single ZADD - no row-by-row rank rewrites, and because the set lives in the
 * cluster's shared Redis every worker sees the update at once (an in-process
 * cache could not). Sorted-set scores are float64: exact for integers below
 * 2^53, far above any realistic xp/score.
 */

// Skills/overall are scored by *total* xp: it rises monotonically with level
// then xp, so it orders identically to (level, xp) without packing two numbers.
type GlobalMetric = 'pp' | 'score' | 'overall' | SkillName | GoodGrade | 'allgrades';
type CountryMetric = GlobalMetric;

const PREFIX = `${redisKeyPrefix}ranking:`;
// Meta keys live outside PREFIX so the rebuild's `${PREFIX}*` wipe can't delete
// the build lock out from under itself (which would let a second worker rebuild
// in parallel).
const META = `${redisKeyPrefix}rankmeta:`;
// Bump when the set layout changes so the next deploy rebuilds from MySQL.
const SCHEMA = 3;
const builtKey = `${META}built:v${SCHEMA}`;
const lockKey = `${META}lock:v${SCHEMA}`;

const suffix = (country?: string) => country === undefined ? '' : `:c:${country || '__'}`;
const globalKey = (m: GlobalMetric) => `${PREFIX}${m}`;
const countryKey = (m: CountryMetric, country: string) => `${PREFIX}${m}${suffix(country)}`;
// One sorted set per beatmap (and per beatmap+country), scored by best score.
const beatmapKey = (beatmapId: number, country?: string) => `${PREFIX}bm:${beatmapId}${suffix(country)}`;

const PAGE_SIZE = 50;

/** Add/refresh every set entry for one character in a single pipeline. */
function index(pipeline: ReturnType<typeof redis.pipeline>, data: Awaited<ReturnType<typeof getCharacterFields>>) {
	if (!data) return;

	const member = String(data.character.id);
	pipeline.zadd(globalKey('pp'), Number(data.character.pp), member);
	pipeline.zadd(globalKey('score'), data.character_totals?.rankedScore ?? 0, member);
	pipeline.zadd(globalKey('overall'), data.character.overallTotalXp, member);
	pipeline.zadd(countryKey('pp', data.user.country), Number(data.character.pp), member);
	pipeline.zadd(countryKey('score', data.user.country), data.character_totals?.rankedScore ?? 0, member);
	pipeline.zadd(countryKey('overall', data.user.country), data.character.overallTotalXp, member);
	for (const skill of Skills) {
		pipeline.zadd(globalKey(skill), data.character[`${skill}TotalXp`], member);
		pipeline.zadd(countryKey(skill, data.user.country), data.character[`${skill}TotalXp`], member);
	}
	let allgrades = 0;
	for (const grade of GoodGrades) {
		pipeline.zadd(globalKey(grade), data.character_totals?.[grade] ?? 0, member);
		pipeline.zadd(countryKey(grade, data.user.country), data.character_totals?.[grade] ?? 0, member);
		allgrades += data.character_totals?.[grade] ?? 0;
	}
	pipeline.zadd(globalKey('allgrades'), allgrades, member);
	pipeline.zadd(countryKey('allgrades', data.user.country), allgrades, member);
}

const getCharacterFields = async (id: number) => {
	const [row] = await db
		.select()
		.from(characters)
		.leftJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.where(eq(characters.id, id))
		.limit(1);
	if (!row) return;
	return row;
};

/** Re-index one character after its metrics change. Called once per finalized
 *  play and on character creation. */
export const reindexCharacter = async (id: number) => {
	const character = await getCharacterFields(id);
	if (!character) return;
	const pipeline = redis.pipeline();
	index(pipeline, character);
	await pipeline.exec();
};

/** 1-based rank, or undefined when the character is not in the set. */
const rankIn = async (key: string, id: number): Promise<number | undefined> => {
	const r = await redis.zrevrank(key, String(id));
	return r === null ? undefined : r + 1;
};

export const globalRank = (m: GlobalMetric, id: number) => rankIn(globalKey(m), id);
export const countryRank = (m: CountryMetric, country: string, id: number) => rankIn(countryKey(m, country), id);

/** The single skill this character ranks highest in, globally. */
export async function bestSkillRank(id: number): Promise<{ skill: SkillName; rank: number } | undefined> {
	const pipeline = redis.pipeline();
	for (const s of Skills) pipeline.zrevrank(globalKey(s), String(id));
	const res = await pipeline.exec();

	let best: { skill: SkillName; rank: number } | undefined;
	res?.forEach(([err, value], i) => {
		if (err || value === null) return;
		const rank = (value as number) + 1;
		if (!best || rank < best.rank) best = { skill: Skills[i], rank };
	});
	return best;
}

/** The character ids on a leaderboard page, in rank order. */
const pageIds = async (key: string, page: number): Promise<number[]> => {
	const start = (page - 1) * PAGE_SIZE;
	const ids = await redis.zrevrange(key, start, start + PAGE_SIZE - 1);
	return ids.map(Number);
};

/** Hydrate ranked ids into the joined rows the listings render, in rank order. */
async function hydrate(ids: number[]) {
	if (ids.length === 0) return [];
	const rows = await db
		.select()
		.from(characters)
		.innerJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.where(inArray(characters.id, ids));
	const byId = new Map(rows.map(r => [r.character.id, r]));
	return ids.map(id => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
}

const hydratePage = async (key: string, page: number) => hydrate(await pageIds(key, page));

/** Countries that have at least one player, with their player count, most
 *  populated first. Cached briefly - the list changes only when a new country's
 *  first player joins, and a few minutes of staleness on a filter list is fine. */
let countriesCache: { at: number; rows: { country: string; count: number }[] } | undefined;
const COUNTRIES_TTL = 5 * 60 * 1000;

export async function playerCountries(): Promise<{ country: string; count: number }[]> {
	if (countriesCache && Date.now() - countriesCache.at < COUNTRIES_TTL) return countriesCache.rows;
	const rows = await db
		.select({ country: users.country, count: count() })
		.from(characters)
		.innerJoin(users, eq(users.id, characters.userId))
		.groupBy(users.country)
		.orderBy(desc(count()));
	countriesCache = { at: Date.now(), rows };
	return rows;
}

const metricKey = (m: GlobalMetric, country?: string) => country === undefined ? globalKey(m) : countryKey(m, country);

export const skillPage = (skill: GlobalMetric, page: number, country?: string) => hydratePage(metricKey(skill, country), page);
export const gradesPage = (grade: GoodGrade | 'all', page: number, country?: string) => hydratePage(metricKey(grade === 'all' ? 'allgrades' : grade, country), page);
export const ppPage = (page: number, country?: string) => hydratePage(metricKey('pp', country), page);
export const scorePage = (page: number, country?: string) => hydratePage(metricKey('score', country), page);

/** Per-beatmap leaderboard: the character ids with a best on this map, in score
 *  order (global or within one country). The route hydrates the `best` rows. */
export const beatmapPageIds = (beatmapId: number, page: number, country?: string) => pageIds(beatmapKey(beatmapId, country), page);
export const beatmapRank = (beatmapId: number, characterId: number, country?: string) => rankIn(beatmapKey(beatmapId, country), characterId);

/** Re-index a character's best on one beatmap after a play improves it. */
export async function reindexBeatmap(characterId: number, beatmapId: number): Promise<void> {
	const [row] = await db
		.select({ score: best.score, country: users.country })
		.from(best)
		.innerJoin(characters, eq(characters.id, best.characterId))
		.innerJoin(users, eq(users.id, characters.userId))
		.where(and(eq(best.beatmapId, beatmapId), eq(best.characterId, characterId)))
		.limit(1);
	if (!row) return;
	const member = String(characterId);
	const pipeline = redis.pipeline();
	pipeline.zadd(beatmapKey(beatmapId), row.score, member);
	pipeline.zadd(beatmapKey(beatmapId, row.country), row.score, member);
	await pipeline.exec();
}

/** Rebuild every set from MySQL. One DB pass, pipelined in chunks. */
export async function rebuildAll(): Promise<void> {
	for await (const key of scanKeys(`${PREFIX}*`)) await redis.del(key);

	const rows = await db
		.select()
		.from(characters)
		.leftJoin(character_totals, eq(character_totals.id, characters.id))
		.innerJoin(users, eq(users.id, characters.userId))
		.orderBy(desc(characters.pp));

	let pipeline = redis.pipeline();
	for (let i = 0; i < rows.length; i++) {
		index(pipeline, rows[i]);
		if (i % 200 === 199) {
			await pipeline.exec();
			pipeline = redis.pipeline();
		}
	}
	await pipeline.exec();

	const bests = await db
		.select({ beatmapId: best.beatmapId, characterId: best.characterId, score: best.score, country: users.country })
		.from(best)
		.innerJoin(characters, eq(characters.id, best.characterId))
		.innerJoin(users, eq(users.id, characters.userId));

	pipeline = redis.pipeline();
	for (let i = 0; i < bests.length; i++) {
		const b = bests[i];
		const member = String(b.characterId);
		pipeline.zadd(beatmapKey(b.beatmapId), b.score, member);
		pipeline.zadd(beatmapKey(b.beatmapId, b.country), b.score, member);
		if (i % 200 === 199) {
			await pipeline.exec();
			pipeline = redis.pipeline();
		}
	}
	await pipeline.exec();
}

async function* scanKeys(match: string): AsyncGenerator<string> {
	let cursor = '0';
	do {
		const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 500);
		cursor = next;
		yield* keys;
	} while (cursor !== '0');
}

/** Build the sets once per deploy (versioned), elected to a single cluster
 *  worker. Cheap to call on every boot: returns immediately once built. */
export async function ensureRankings(): Promise<void> {
	if (await redis.exists(builtKey)) return;
	const got = await redis.set(lockKey, '1', 'EX', 300, 'NX');
	if (got !== 'OK') return;
	try {
		await rebuildAll();
		await redis.set(builtKey, '1');
		console.log('Rankings index built.');
	} finally {
		await redis.del(lockKey);
	}
}
