import { randomUUID } from 'node:crypto';
import '@osu-idle/shared/osu/controlPointPatch';
import { BeatmapDecoder } from 'osu-parsers';
import { ManiaGame, unstableRate } from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, { fatigueXPFactor, getRecoveryTime } from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import { type SkillName } from '@osu-idle/shared/skills';
import { Judgements, type Judgement } from '@osu-idle/shared/judgement';
import type { ReplayOffsetDTO } from '@osu-idle/shared/play';
import type { ScoreDTO } from '@osu-idle/shared/score';
import type { CharacterRow } from './db/schema/character';
import type { NewScoreRow, ScoreRow } from './db/schema/score';
import Memory from '@osu-idle/shared/sim/skills/memory';
import { calculatePP } from './pp';
import { loadChart } from './beatmaps';
import { getPlays } from './db/schema/beatmaps_played';
import { MINDBLOCK_SKILLS, mindblockFactor, recentMapPlays } from './mindblock';
import { applySkillXp, submitScore } from './scores';
import { isProd, redisKeyPrefix } from './env';
import { redis } from './redis';
import num from '@osu-idle/shared/display/num';

/** A pending play is forgotten after this long max paused time. */
const PENDING_TTL_MS = 3 * 60 * 60 * 1000;
const ONLINE_TTL = 60 * 60 * 1000;
const PLAYING_TTL = 10 * 1000;
const SESSION_TTL = 60 * 60 * 1000;

const decoder = new BeatmapDecoder();

type Pending = {
	characterId: number;
	setId: number;
	draft: NewScoreRow;
	skillXp: Record<SkillName, number>;
	/** earliest wall-clock time (epoch ms) a completion is accepted (anti-cheat) */
	minCompleteAt: number;
	/** input index where HP hit 0, or null if the play survives */
	failedAt: number | null;
	expires: number;
};

type PlayTime = {
	characterId: number,
	lastEnd: number,
	currentStrainTime: number,
	currentMapTime: number,
};

// All cross-request play state lives in Redis (not process memory) so the API
// can run as a pm2 cluster: a play started on one worker is visible to the
// worker that completes it. A `pending` play is a string key with a TTL; the
// `playing` / `online` presence sets are sorted sets scored by time, which gives
// both a live count and time-based eviction for free.
const PLAYING_KEY = `${redisKeyPrefix}playing`;
const ONLINE_KEY = `${redisKeyPrefix}online`;
const pendingKey = (token: string) => `${redisKeyPrefix}pending:${token}`;
const playTimeKey = (characterId: number) => `${redisKeyPrefix}playtime:${characterId}`;

/**
 * Acquire the per-character play lock or refuse. A Lua script so the check and
 * the set are atomic across workers: two starts racing on different processes
 * can't both pass the simultaneous-play guard. The lock is a member of the
 * `playing` set scored by the time it stays held. Returns 1 if acquired, 0 if
 * the character is already mid-play.
 */
const ACQUIRE_PLAY = `
local held = redis.call('ZSCORE', KEYS[1], ARGV[1])
if held and tonumber(held) > tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
return 1
`;

/**
 * Atomically read-validate-delete a pending play, returning its JSON only when
 * the token exists and belongs to `characterId`. The delete is part of the
 * script, so a retried or duplicated complete can't submit the same score twice.
 */
const TAKE_PENDING = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
if cjson.decode(v).characterId ~= tonumber(ARGV[1]) then return false end
redis.call('DEL', KEYS[1])
return v
`;

/** Mark a character active now (presence + the "online in the last hour" set). */
const markOnline = (characterId: number) => redis.zadd(ONLINE_KEY, Date.now(), String(characterId));

/** Count of characters currently mid-play; prunes locks past their hold window. */
export async function getPlaying(): Promise<number> {
	await redis.zremrangebyscore(PLAYING_KEY, '-inf', Date.now() - PLAYING_TTL);
	return redis.zcard(PLAYING_KEY);
}

/** Count of characters seen within the last hour (never below those playing). */
export async function getOnline(): Promise<number> {
	await redis.zremrangebyscore(ONLINE_KEY, '-inf', Date.now() - ONLINE_TTL);
	const c = await redis.zcard(ONLINE_KEY);
	return Math.max(await getPlaying(), c);
}

/** A character's live session strain, or null if it has none / has recovered. */
export async function getPlayTime(characterId: number): Promise<PlayTime | null> {
	const v = await redis.get(playTimeKey(characterId));
	if (!v) return null;
	const session = JSON.parse(v) as PlayTime;
	// JSON has no -Infinity: a session that never ended serialises lastEnd as null.
	if (!Number.isFinite(session.lastEnd)) session.lastEnd = -Infinity;
	return session;
}

/**
 * Persist a session with a TTL matching the old in-memory eviction horizon - the
 * point its strain has fully recovered, plus SESSION_TTL slack. Over-retention is
 * harmless: startPlay re-clamps recovered strain to zero on the next play.
 */
function setPlayTime(session: PlayTime) {
	const ttl = Math.max(SESSION_TTL, session.currentStrainTime + session.currentMapTime + SESSION_TTL);
	return redis.set(playTimeKey(session.characterId), JSON.stringify(session), 'PX', Math.round(ttl));
}

export type StartPlayResult =
	| { status: 'ranked'; token: string; offsets: ReplayOffsetDTO[]; failedAt: number | null }
	| { status: 'unranked' }
	| { status: 'refused' };


/**
 * Run the authoritative simulation for a character on a beatmap and stash a
 * pending play. Returns:
 *  - 'ranked'   - simulated; the offsets let the client reproduce the exact play.
 *  - 'unranked' - the map isn't ingested; the client plays it locally.
 *  - 'refused'  - declined the play (the anti-cheat lock for a near-simultaneous
 *                 second start); the client surfaces this to the player.
 */
export async function startPlay(
	character: CharacterRow,
	beatmapId: number,
	setId: number,
): Promise<StartPlayResult> {
	await markOnline(character.id);
	// Provisional 60s lock so a near-simultaneous second start is refused while
	// this one simulates. Atomic across workers (see ACQUIRE_PLAY).
	const now = Date.now();
	const acquired = await redis.eval(ACQUIRE_PLAY, 1, PLAYING_KEY, String(character.id), String(now), String(now + 60000)) as number;
	if (acquired !== 1) {
		const held = Number(await redis.zscore(PLAYING_KEY, String(character.id)));
		console.log(character.id, character.name, 'tried playing at once. remaining cooldown: ', held - now);
		return { status: 'refused' };
	}
	const chart = await loadChart(beatmapId);
	if (!chart) {
		await redis.zrem(PLAYING_KEY, String(character.id));
		return { status: 'unranked' };
	}

	const skills = makeOrderedSkills();
	for (const skill of skills) {
		skill.level.set(character[`${skill.name}Level`]);
		skill.xp.set(character[`${skill.name}Xp`]);

		if (skill instanceof Memory) {
			skill.timesPlayed.set(await getPlays(character.id, beatmapId));
		}
	}

	const beatmap = decoder.decodeFromString(chart);
	const bot = new CharacterBot(skills, beatmap.difficulty.overallDifficulty);
	const game = new ManiaGame(beatmap, bot);
	game.update(game.songEndMs + 1000); // advance past the end so every note is judged

	const session = (await getPlayTime(character.id)) ?? {
		characterId: character.id,
		lastEnd: -Infinity,
		currentStrainTime: 0,
		currentMapTime: 0,
	} satisfies PlayTime;

	session.currentStrainTime = Math.max(0, session.currentStrainTime - getRecoveryTime(session.lastEnd, Date.now()));
	session.currentMapTime = beatmap.totalLength;

	await setPlayTime(session);

	const score = game.score;
	const fatigue = fatigueXPFactor((session?.currentStrainTime ?? 0) / 1000);
	const skillXp = bot.getSkillsXP(beatmap.totalLength, score, fatigue);

	// Mindblock: grinding the same map recently dulls its technique XP (stamina /
	// memory exempt). Read from the persisted history, before this play is stored.
	const recentPlays = await recentMapPlays(character.id, beatmapId);
	const block = mindblockFactor(recentPlays);
	if (block < 1) {
		for (const name of MINDBLOCK_SKILLS) skillXp[name] = Math.floor(skillXp[name] * block);
	}

	const pp = calculatePP(score, chart);
	const c = score.counts;

	const draft: NewScoreRow = {
		characterId: character.id,
		beatmapId,
		score: Math.round(score.score),
		accuracy: String(score.accuracy),
		maxCombo: score.maxCombo,
		...(Object.fromEntries(Judgements.map(j => [j, c[j]])) as Record<Judgement, number>),
		grade: score.grade,
		pp: String(pp),
		ur: String(unstableRate(game.hits)),
		pfc: c.MISS === 0 && c.BAD === 0 && c.GOOD === 0,
		playedAt: new Date(),
	};

	const failedAt = score.failed ? score.failedIndex : null;
	// A play ends either when HP hits 0 (a mid-map fail stops gameplay early) or,
	// surviving, at the last note. Gate the anti-cheat completion check on the point
	// the client actually plays to - otherwise an early fail completes well before a
	// last-note-based deadline and is wrongly rejected as "too soon". `hits` is
	// parallel to the judgement sequence, so the failing judgement's note time is
	// the song time at which the play stops.
	const firstNoteStart = game.notes.reduce((m, n) => Math.min(m, n.time), Infinity);
	const lastNoteStart = game.notes.reduce((m, n) => Math.max(m, n.time), 0);
	const endSongTime = failedAt !== null ? game.hits[failedAt - 1].time : lastNoteStart;
	const minCompleteAt = Date.now() + Math.max(0, endSongTime - 5000) - firstNoteStart;

	const token = randomUUID();
	const ttl = endSongTime + PENDING_TTL_MS;
	const entry: Pending = {
		characterId: character.id,
		setId,
		draft,
		skillXp,
		minCompleteAt,
		failedAt,
		expires: Date.now() + ttl,
	};
	await redis.set(pendingKey(token), JSON.stringify(entry), 'PX', Math.round(ttl));

	// Promote the provisional lock to the real completion deadline.
	await redis.zadd(PLAYING_KEY, minCompleteAt, String(character.id));
	console.log(character.id, character.name, 'is now playing (fatigue: ' + (num((1 - fatigue)* 100, 2)) + '%, mindblock: ' + num((1 - block) * 100, 2) + '% over ' + recentPlays + ' recent plays, strain time: ' + num((session.currentStrainTime ?? 0) / 1000 / 3600, 2) + 'h). playing users:', await getPlaying());

	return { status: 'ranked', token, offsets: game.replayOffsets(), failedAt };
}

/**
 * Finalise a pending play: verify the completion isn't suspiciously early, then
 * (unless the play failed) persist the score, award the XP, and return both.
 */
export async function completePlay(characterId: number, token: string, abort: string) {
	// Atomically claim the pending play (deletes it) so a duplicate complete can't
	// double-submit. Returns null unless the token exists and is this character's.
	const raw = await redis.eval(TAKE_PENDING, 1, pendingKey(token), String(characterId)) as string | null;
	if (!raw) return { ok: false, reason: 'unknown' };
	const p = JSON.parse(raw) as Pending;
	await redis.zrem(PLAYING_KEY, String(characterId));

	console.log(characterId, 'finished. playing users:', await getPlaying());
	if (abort === '1') return { ok: true, failed: true };
	if (isProd && Date.now() < p.minCompleteAt) return { ok: false, reason: 'tooSoon' };

	if (p.failedAt !== null) return { ok: true, failed: true };

	p.draft.playedAt = new Date();
	const row = await submitScore(p.draft);
	const gains = await applySkillXp(characterId, p.skillXp);

	const session = (await getPlayTime(characterId)) ?? {
		characterId,
		lastEnd: -Infinity,
		currentStrainTime: 0,
		currentMapTime: 0,
	} satisfies PlayTime;

	session.currentStrainTime += session.currentMapTime ?? 0;
	session.currentMapTime = 0;
	session.lastEnd = Date.now();

	await setPlayTime(session);

	return { ok: true, failed: false, score: scoreRowToDTO(row), gains };
}

function scoreRowToDTO(row: ScoreRow): ScoreDTO {
	return {
		id: row.id,
		characterId: row.characterId,
		beatmapId: row.beatmapId,
		score: row.score,
		accuracy: Number(row.accuracy),
		maxCombo: row.maxCombo,
		judgements: Object.fromEntries(Judgements.map(j => [j, row[j]])) as Record<Judgement, number>,
		grade: row.grade,
		pp: Number(row.pp),
		ur: Number(row.ur),
		pfc: row.pfc,
		playedAt: (row.playedAt ?? new Date()).getTime(),
	};
}
