import { randomUUID } from 'node:crypto';
import '@osu-idle/shared/osu/controlPointPatch';
import { BeatmapDecoder } from 'osu-parsers';
import {
	LEAD_IN_MS,
	ManiaGame,
	unstableRate,
	type ReplayOffset,
} from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, {
	fatigueXPFactor,
	getRecoveryTime,
} from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import {
	MINDBLOCK_SKILLS,
	type SkillName,
} from '@osu-idle/shared/skills';
import {
	compareGradeGT,
	compareGradeGTE,
	GRADE,
	Judgements,
	type Judgement,
} from '@osu-idle/shared/judgement';
import type { ScoreDTO } from '@osu-idle/shared/score';
import type { CharacterRow } from './db/schema/character';
import type {
	NewScoreRow,
	ScoreRow,
} from './db/schema/score';
import Memory from '@osu-idle/shared/sim/skills/memory';
import { calculatePP } from './pp';
import { getBeatmap } from './beatmaps';
import { getPlays } from './db/schema/beatmaps_played';
import {
	mindblockFactor,
	recentMapPlays,
} from './mindblock';
import {
	applySkillXp,
	submitScore,
} from './scores';
import {
	reindexBeatmap,
	reindexCharacter,
} from './rankings';
import {
	isProd,
	redisKeyPrefix,
} from './env';
import { redis } from './redis';
import { getBestPlay } from './db/schema/best';
import type { Beatmap } from 'osu-classes';
import type { ScoreState } from '@osu-idle/shared/sim/scoring';

/** A finished play's result stays fetchable this long (resume / cross-tab). */
const RESULT_TTL_MS = 10 * 60 * 1000;
const RESULT_BREATH_TTL_MS = 5 * 1000;
const ONLINE_TTL = 60 * 60 * 1000;
const SESSION_TTL = 60 * 60 * 1000;

const decoder = new BeatmapDecoder();

/** How far ahead of the live position the client may know its replay. The client
 *  streams offsets in; the server reveals only those whose note is within this
 *  window of the live position, so a cheater can't read the whole outcome up front. */
const STREAM_BUFFER_MS = 5000;

/** A play's full server-side state. `offsets`/`reveals` are parallel and sorted by
 *  reveal time (the offset's note nominal time), so streaming is a simple cursor. */
type Pending = {
	token: string,
	characterId: number,
	beatmapId: number,
	offsets: ReplayOffset[],
	reveals: number[],
	startedAt: number,
	endsAt: number,
	songStartMs: number,
	draft: NewScoreRow,
	skillXp: Record<SkillName, number>,
	skipped?: true,
	failedAt?: number,
};

/** Per-skill XP progression returned to the result screen. */
type Gains = Awaited<ReturnType<typeof applySkillXp>>;

/** The finished result. `notify` drives the one-shot idle-poll popup: true only
 *  when finalised server-side (the sweep), so a result a client already saw on
 *  its own result screen isn't re-surfaced as a "missed" score. */
type StoredResult =
	| { token: string; failed: true; notify: boolean }
	| { token: string; failed: false; score: ScoreDTO; gains: Gains; notify: boolean };

type PlayTime = {
	characterId: number,
	lastEnd: number,
	currentStrainTime: number,
	currentMapTime: number,
};

const PLAYING_KEY = `${redisKeyPrefix}playing`;
const ONLINE_KEY = `${redisKeyPrefix}online`;
const playKey = (characterId: number) => `${redisKeyPrefix}play:${characterId}`;
const resultKey = (characterId: number) => `${redisKeyPrefix}result:${characterId}`;
const playTimeKey = (characterId: number) => `${redisKeyPrefix}playtime:${characterId}`;

/**
 * Acquire the per-character start lock or refuse. A Lua script so the check and
 * the set are atomic across workers: two cold starts racing on different
 * processes can't both pass into simulation. The lock is a member of the
 * `playing` set scored by the time it stays held. Returns 1 if acquired, 0 if a
 * start is already in flight.
 */
const ACQUIRE_PLAY = `
local held = redis.call('ZSCORE', KEYS[1], ARGV[1])
if held and tonumber(held) > tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
return 1
`;

/**
 * Atomically read-validate-delete the active play, returning its JSON only when
 * it exists and belongs to `characterId`. The delete is part of the script, so
 * concurrent sweep/finalise calls can't submit the same score twice.
 */
const TAKE_PLAY = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
if cjson.decode(v).characterId ~= tonumber(ARGV[1]) then return false end
redis.call('DEL', KEYS[1])
return v
`;

/** Like TAKE_PLAY but also requires the token to match - a stale client must not
 *  abort a newer play. */
const ABORT_PLAY = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
local d = cjson.decode(v)
if d.characterId ~= tonumber(ARGV[1]) then return false end
if d.token ~= ARGV[2] then return false end
redis.call('DEL', KEYS[1])
return v
`;

/**
 * Persist a lead-in skip: shift the whole timeline earlier so the live position
 * jumps to `songStartMs` and the play finalises that much sooner. Token must match.
 * Re-scores the play in `playing` by the new end. A re-fire is a no-op: once at/past
 * `songStartMs` the delta is <= 0.
 */
const SKIP_PLAY = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
local d = cjson.decode(v)
if d.characterId ~= tonumber(ARGV[1]) then return false end
if d.token ~= ARGV[2] then return false end
local now = tonumber(ARGV[3])
local pos = now - d.startedAt - tonumber(ARGV[4])
local delta = d.songStartMs - pos
if delta <= 0 then return v end
d.startedAt = d.startedAt - delta
d.endsAt = d.endsAt - delta
d.skipped = true
local out = cjson.encode(d)
redis.call('SET', KEYS[1], out)
redis.call('ZADD', KEYS[2], d.endsAt, ARGV[1])
return out
`;

/** Mark a character active now (presence + the "online in the last hour" set). */
const markOnline = (characterId: number) => redis.zadd(ONLINE_KEY, Date.now(), String(characterId));

/** Count of characters currently mid-play: members whose end is still ahead. */
export async function getPlaying(): Promise<number> {
	return redis.zcount(PLAYING_KEY, Date.now(), '+inf');
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

type OffsetChunk = {
	offsets: ReplayOffset[],
	next: number,
	done: boolean,
};

type RankedStartPlayResult = {
	status: 'ranked',
	joined: boolean,
	token: string,
	startedAt: number,
	endsAt: number,
} & OffsetChunk;

/** The offsets revealed so far: every one whose note is within the buffer window
 *  of the live position. `next` is the resume cursor; `done` once all are sent. */
function chunkFrom(p: Pending, from: number): OffsetChunk {
	const horizon = Date.now() - p.startedAt - LEAD_IN_MS + STREAM_BUFFER_MS;
	let i = Math.max(0, from);
	while (i < p.reveals.length && p.reveals[i] <= horizon) i++;
	return {
		offsets: p.offsets.slice(from, i), next: i, done: i >= p.offsets.length,
	};
}

type StartPlayResult = RankedStartPlayResult
	| { status: 'unranked' }
	| { status: 'refused' };

/** Build the character's skills, loaded with their level/XP (and play count for
 *  Memory) so the simulation runs at the character's current state. */
async function loadCharacterSkills(character: CharacterRow, beatmapId: number) {
	const skills = makeOrderedSkills();
	for (const skill of skills) {
		skill.level.set(character[`${skill.name}Level`]);
		skill.xp.set(character[`${skill.name}Xp`]);

		if (skill instanceof Memory) {
			skill.timesPlayed.set(await getPlays(character.id, beatmapId));
		}
	}
	return skills;
}

/** Read the active play (if any) without claiming it. */
async function readPlay(characterId: number): Promise<Pending | undefined> {
	const raw = await redis.get(playKey(characterId));
	return raw ? (JSON.parse(raw) as Pending) : undefined;
}

const joinResult = (p: Pending): StartPlayResult => ({
	status: 'ranked',
	joined: true,
	token: p.token,
	startedAt: p.startedAt,
	endsAt: p.endsAt,
	...chunkFrom(p, 0),
});

/** Join the play already in progress for this character (spectate), or null to
 *  start a fresh one. An overdue play (past its end, sweep hasn't run) is
 *  finalised first so a new play can begin. */
async function joinExisting(characterId: number): Promise<StartPlayResult | null> {
	const existing = await readPlay(characterId);
	if (!existing) return null;
	if (Date.now() < existing.endsAt) return joinResult(existing);
	await finalizePlay(characterId);
	return null;
}

/**
 * Start a play, or join the one already in progress for this character.
 *  - 'ranked'   - simulated (or joined); the offsets + start time let the client
 *                 reproduce the play seeked to its live position.
 *  - 'unranked' - the map isn't ingested; the client plays it locally.
 *  - 'refused'  - a cold-start race lost the lock and no record had landed yet;
 *                 the client retries (its spectate poll picks the play up too).
 */
export async function startPlay(
	character: CharacterRow,
	beatmapId: number,
): Promise<StartPlayResult> {
	await markOnline(character.id);

	// Already playing? Join it (spectate) rather than starting a second.
	const joined = await joinExisting(character.id);
	if (joined) return joined;

	// Provisional 60s lock so a near-simultaneous cold start is held off while
	// this one simulates. Atomic across workers (see ACQUIRE_PLAY).
	const now = Date.now();
	const acquired = await redis.eval(
		ACQUIRE_PLAY, 
		1, 
		PLAYING_KEY, 
		String(character.id), 
		String(now),
		String(now + 60000),
	) as number;
	if (acquired !== 1) {
		// Someone else is mid-simulation; if their record has landed, join it.
		const raced = await readPlay(character.id);
		if (raced) return joinResult(raced);
		const held = Number(await redis.zscore(PLAYING_KEY, String(character.id)));
		console.log(
			character.id, 
			character.name,
			'tried playing at once. remaining cooldown: ',
			held - now,
		);
		return { status: 'refused' };
	}
	const beatmap = await getBeatmap(beatmapId);
	if (!beatmap) {
		await redis.zrem(PLAYING_KEY, String(character.id));
		return { status: 'unranked' };
	}
	return simulateAndStore(character, beatmapId, beatmap);
}

const getServerXP = async (
	character: CharacterRow,
	session: PlayTime,
	bot: CharacterBot,
	beatmap: Awaited<ReturnType<typeof getBeatmap>>,
	chart: Beatmap,
	score: ScoreState,
) => {
	const currentBest = await getBestPlay(character.id, beatmap.id);

	const fatigue = fatigueXPFactor((session?.currentStrainTime ?? 0) / 1000);
	const skillXp = bot.getSkillsXP(chart.totalLength, score, fatigue);

	// Mindblock: grinding the same map recently dulls its technique XP (stamina /
	// memory exempt). Read from the persisted history, before this play is stored.
	const recentPlays = await recentMapPlays(character.id, beatmap.id);
	const block = mindblockFactor(recentPlays);
	if (block < 1) {
		for (const name of MINDBLOCK_SKILLS) skillXp[name] = Math.floor(skillXp[name] * block);
	}

	if (compareGradeGTE(score.grade, GRADE.X) 
		&& (!currentBest || compareGradeGT(score.grade, currentBest.grade))) {
		skillXp.accuracy += Math.floor(1000 * Number(beatmap.sr));
	}

	return skillXp;
};

/** Run the authoritative simulation, compute the score + XP, and store the play.
 *  The provisional lock is already held; this promotes it to the real end time. */
async function simulateAndStore(
	character: CharacterRow,
	beatmapId: number,
	beatmap: Awaited<ReturnType<typeof getBeatmap>>,
): Promise<StartPlayResult> {
	const skills = await loadCharacterSkills(character, beatmapId);

	const chart = decoder.decodeFromString(beatmap.chart);
	const bot = new CharacterBot(skills, chart.difficulty.overallDifficulty);
	const game = new ManiaGame(chart, bot);
	game.update(game.songEndMs + 1000); // advance past the end so every note is judged

	const session = (await getPlayTime(character.id)) ?? {
		characterId: character.id,
		lastEnd: -Infinity,
		currentStrainTime: 0,
		currentMapTime: 0,
	} satisfies PlayTime;

	session.currentStrainTime = Math.max(0,
		session.currentStrainTime - getRecoveryTime(session.lastEnd, Date.now()),
	);
	session.currentMapTime = chart.totalLength;

	await setPlayTime(session);

	const score = game.score;

	const pp = calculatePP(score, beatmap.chart);
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

	const failedAt = score.failed ? score.failedIndex : undefined;
	const lastNoteEnd = game.notes.reduce((m, n) => Math.max(m, n.hold ? n.endTime : n.time), 0);
	const endSongTime = failedAt ? game.hits[failedAt - 1].time : lastNoteEnd;
	const startedAt = Date.now();
	const endsAt = startedAt + LEAD_IN_MS + endSongTime;

	// Sort the offsets by reveal time (their note's nominal time) so the client can
	// stream them in with a simple forward cursor and never learn the outcome early.
	const noteById = new Map(game.notes.map(n => [n.getId(), n]));
	const revealOf = (o: ReplayOffset) => {
		const note = noteById.get(o.id)!;
		return o.tail ? note.endTime : note.time;
	};
	const ordered = game.replayOffsets()
		.map(o => ({
			o, reveal: revealOf(o), 
		}))
		.sort((a, b) => a.reveal - b.reveal);

	const token = randomUUID();
	const entry: Pending = {
		token,
		characterId: character.id,
		beatmapId,
		offsets: ordered.map(x => x.o),
		reveals: ordered.map(x => x.reveal),
		startedAt,
		endsAt,
		songStartMs: game.songStartMs,
		draft,
		skillXp: await getServerXP(
			character,
			session,
			bot,
			beatmap,
			chart,
			score,
		),
	};
	if (failedAt) {
		entry.failedAt = failedAt;
	}
	await redis.set(playKey(character.id), JSON.stringify(entry));

	// Promote the provisional lock to the real end time (drives the sweep + count).
	await redis.zadd(PLAYING_KEY, endsAt, String(character.id));

	return {
		status: 'ranked',
		joined: false,
		token,
		startedAt,
		endsAt,
		...chunkFrom(entry, 0),
	};
}

/**
 * Obtain play data by deleting it so we can consume it without duplication
 */
const getAndDeletePlay = async(characterId: number): Promise<Pending | undefined> => {
	const result = await redis.eval(
		TAKE_PLAY,
		1, 
		playKey(characterId),
		String(characterId),
	) as string | undefined;
	if (!result) return;
	return JSON.parse(result) as Pending;
};

const parsePlayResult = async (play: Pending, notify: boolean): Promise<StoredResult> => {
	const characterId = play.characterId;

	if (play.failedAt) {
		return {
			token: play.token,
			failed: true,
			notify,
		};
	}

	play.draft.playedAt = new Date();
	const row = await submitScore(play.draft);
	const gains = await applySkillXp(characterId, play.skillXp);
	await reindexCharacter(characterId);
	await reindexBeatmap(characterId, play.draft.beatmapId);

	const session = (await getPlayTime(characterId)) ?? {
		characterId,
		lastEnd: -Infinity,
		currentStrainTime: 0,
		currentMapTime: 0,
	} satisfies PlayTime;

	session.currentStrainTime += session.currentMapTime;
	session.currentMapTime = 0;
	session.lastEnd = Date.now();
	await setPlayTime(session);

	return {
		token: play.token,
		failed: false,
		score: scoreRowToDTO(row),
		gains,
		notify,
	};
};

/**
 * Consumes a pending play to persist the score result.
 * @param serverSide True when finalised on the server's own clock (the sweep),
 *   not by a client reading its result. Only these are notifiable: a result a
 *   client already saw on its result screen must not re-surface from idle polls.
 */
export async function finalizePlay(
	characterId: number, 
	serverSide: boolean = false,
): Promise<StoredResult | undefined> {
	const play = await getAndDeletePlay(characterId);
	if (!play) return;

	// Free up the character slot for playing again
	await redis.zrem(PLAYING_KEY, String(characterId));

	const result = await parsePlayResult(play, serverSide);

	await redis.set(resultKey(characterId), JSON.stringify(result), 'PX', RESULT_TTL_MS);

	console.log(characterId, 'finished. playing users:', await getPlaying());
	return result;
}

const UnknownResult = {
	ok: false, reason: 'unknown', code: 404, 
} as const;
const CacheMissResult = {
	ok: false, reason: 'cache-miss', code: 410, 
} as const;
const UnfinalizedResult = {
	ok: false, reason: 'unfinalized', code: 432, 
} as const;
const TooSoonResult = {
	ok: false, reason: 'tooSoon', code: 425, 
} as const;
const ScoreResult = (result: StoredResult) => ({
	ok: true,
	failed: result.failed,
	score: result.failed ? undefined : result.score,
	gains: result.failed ? undefined : result.gains,
} as const);

export type FetchResultOutcome =
	| typeof UnknownResult
	| typeof CacheMissResult
	| typeof UnfinalizedResult
	| typeof TooSoonResult
	| ReturnType<typeof ScoreResult>;

export async function fetchResult(
	characterId: number,
	token: string, 
	forceSee: boolean = false,
): Promise<FetchResultOutcome> {

	const cached = await redis.get(resultKey(characterId));
	if (cached) {
		const result = JSON.parse(cached) as StoredResult;
		if (!result.notify && !forceSee) return CacheMissResult;
		else if (result.notify) {
			redis.set(resultKey(characterId), JSON.stringify({
				...result, notify: false, 
			}), 'KEEPTTL');
		}
		if (result.token === token) {
			return ScoreResult(result);
		}
	}

	const play = await readPlay(characterId);
	if (!play || play.token !== token) return UnknownResult;
	if (isProd && Date.now() < play.endsAt) return TooSoonResult;

	const result = (await finalizePlay(characterId));
	
	return result ? ScoreResult(result) : UnfinalizedResult;
}

/** Player quit: drop the play without submitting (token must match). */
export async function abortPlay(characterId: number, token: string): Promise<{ ok: boolean }> {
	const raw = await redis.eval(
		ABORT_PLAY,
		1,
		playKey(characterId),
		String(characterId), 
		token,
	) as string | null;
	if (raw) await redis.zrem(PLAYING_KEY, String(characterId));
	return { ok: raw !== null };
}

/** Player skipped the lead-in: shift the play's timeline so it finalises earlier
 *  (token must match). */
export async function skipPlay(characterId: number, token: string): Promise<{ ok: boolean }> {
	const raw = await redis.eval(
		SKIP_PLAY, 2, playKey(characterId), PLAYING_KEY,
		String(characterId), token, String(Date.now()), String(LEAD_IN_MS),
	) as string | null;
	return { ok: raw !== null };
}

/** Player skipped the lead-in: shift the play's timeline so it finalises earlier
 *  (token must match). */
export async function playStatus(
	characterId: number, 
	token: string,
): Promise<{ ok: true } | { aborted: true } | { ok: true, startedAt: number, endsAt: number }> {
	const play = await readPlay(characterId);
	if (!play || play.token !== token) return { aborted: true };

	if (play.skipped) return {
		ok: true, startedAt: play.startedAt, endsAt: play.endsAt, 
	};
	return { ok: true };
}

/** Stream the next slice of replay offsets, gated to the buffer window so the
 *  client never holds more than a few seconds of the play's future. Returns an
 *  empty done chunk for an unknown/foreign token (the play already finished). */
export async function streamOffsets(
	characterId: number,
	token: string,
	from: number,
): Promise<OffsetChunk> {
	const play = await readPlay(characterId);
	if (!play || play.token !== token) {
		return {
			offsets: [], next: from, done: true,
		};
	}
	return chunkFrom(play, from);
}

/** Current play descriptor for resume-after-refresh / cross-tab spectating. */
export async function getActivePlay(characterId: number) {
	const play = await readPlay(characterId);
	// While the play record exists it's still live (or overdue awaiting finalise).
	// Never finalise here: this is a poll, and finalising would terminate the play
	// out from under its spectator, ejecting it before the result screen. An
	// overdue play is finalised server-side by the sweep (ephemeral result) or by
	// the finishing client itself via fetchResult.
	// primitives only - never spread the whole Pending (heavy offsets/draft/xp)
	if (play) {
		return {
			active: true, token: play.token, beatmapId: play.beatmapId, 
		};
	}
	const result = await redis.get(resultKey(characterId));
	if (result) {
		const stored = JSON.parse(result) as StoredResult;
		return {
			active: false, finished: true, token: stored.token, notify: stored.notify, 
		} as const;
	}
	return {
		active: false, finished: false, 
	} as const;
}

/** Finalise every play whose end time has passed, so abandoned plays still
 *  submit. Safe to run on every worker - the atomic claim guards single submit. */
export async function sweepDuePlays(): Promise<void> {
	const due = await redis.zrangebyscore(PLAYING_KEY, '-inf', Date.now() - RESULT_BREATH_TTL_MS);
	for (const id of due) {
		try {
			await finalizePlay(Number(id), true);
		} catch (e) {
			console.error('[play] sweep finalize failed for', id, e);
		}
	}
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
