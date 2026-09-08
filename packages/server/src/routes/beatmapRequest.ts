import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import {
	and,
	count,
	eq,
	inArray,
} from 'drizzle-orm';
import { z } from 'zod';
import {
	beatmapRequestBody,
	beatmapRequestPatch,
	MAX_PENDING_REQUESTS,
	parseBeatmapsetId,
} from '@osu-idle/shared/beatmapRequest';
import { INTRO_SET_ID } from '@osu-idle/shared/beatmap';
import { isAdmin } from '@osu-idle/shared/admin';
import { db } from '../db/client';
import {
	beatmapRequests,
	beatmapRequestVotes,
} from '../db/schema/beatmap_request';
import { beatmapset } from '../db/schema/beatmapset';
import { users } from '../db/schema/user';
import {
	requireAuth,
	sessionUserId,
} from '../auth/middleware';
import { requireAdmin } from '../auth/admin';
import {
	getManiaSet,
	searchManiaSets,
} from '../db/stats';
import {
	fetchBeatmapset,
	SchedulerError,
} from '../osu/api';
import { downloadOsz } from '../beatmaps/mirror';
import { ingestOsz } from '../beatmaps/ingest';

const idParam = z.coerce.number().int().positive();

const jsonBody = <T extends z.ZodType>(schema: T) =>
	zValidator('json', schema, result => { if (!result.success) throw result.error; });

/** Metadata for a set nobody has requested yet: the stats mirror first (free,
 *  local), then osu! itself for anything it doesn't carry - which is also what
 *  proves the set exists and has a 4K mania difficulty. */
const resolveSet = async (setId: number) => {
	const local = await getManiaSet(setId);
	if (local) return local;

	let set;
	try {
		set = await fetchBeatmapset(setId);
	} catch (e) {
		if (e instanceof SchedulerError) {
			throw new HTTPException(503, { message: 'osu! lookup is unavailable right now, try again later' });
		}
		throw e;
	}
	if (!set) throw new HTTPException(404, { message: 'No beatmapset with that id' });

	const playable = (set.beatmaps ?? []).filter(b => b.mode_int === 3 && Math.round(b.cs) === 4);
	if (!playable.length) {
		throw new HTTPException(400, { message: 'Only osu!mania 4K maps can be ranked in osu!idle' });
	}

	const srs = playable.map(b => b.difficulty_rating);
	return {
		setId,
		artist: set.artist,
		title: set.title,
		creator: set.creator,
		diffs: playable.length,
		srMin: Math.min(...srs),
		srMax: Math.max(...srs),
	};
};

/** Every request, with its backer count, the requester, and - once ingested -
 *  the nomination state of the matching set. */
const listRequests = async (viewerId?: number) => {
	const rows = await db
		.select({
			setId: beatmapRequests.setId,
			userId: beatmapRequests.userId,
			artist: beatmapRequests.artist,
			title: beatmapRequests.title,
			creator: beatmapRequests.creator,
			status: beatmapRequests.status,
			note: beatmapRequests.note,
			createdAt: beatmapRequests.createdAt,
			resolvedAt: beatmapRequests.resolvedAt,
			username: users.username,
			avatarUrl: users.avatarUrl,
			setStatus: beatmapset.status,
			rankedAt: beatmapset.rankedAt,
		})
		.from(beatmapRequests)
		.leftJoin(users, eq(users.id, beatmapRequests.userId))
		.leftJoin(beatmapset, eq(beatmapset.id, beatmapRequests.setId));

	const tallies = await db
		.select({
			setId: beatmapRequestVotes.setId, support: count(),
		})
		.from(beatmapRequestVotes)
		.groupBy(beatmapRequestVotes.setId);
	const support = new Map(tallies.map(t => [t.setId, t.support]));

	const mine = viewerId === undefined ? [] : await db
		.select({ setId: beatmapRequestVotes.setId })
		.from(beatmapRequestVotes)
		.where(eq(beatmapRequestVotes.userId, viewerId));
	const supported = new Set(mine.map(v => v.setId));

	return rows.map(row => ({
		...row,
		username: row.username ?? 'unknown',
		support: support.get(row.setId) ?? 0,
		supported: supported.has(row.setId),
	}));
};

/** Mark every open request for a set as accepted - called the moment its `.osz`
 *  lands, whether it came from the mirror or an admin upload. */
export const acceptRequestsForSet = async (setId: number, adminId?: number): Promise<void> => {
	await db
		.update(beatmapRequests)
		.set({
			status: 'accepted', resolvedAt: new Date(), resolvedBy: adminId,
		})
		.where(and(eq(beatmapRequests.setId, setId), eq(beatmapRequests.status, 'pending')));
};

/**
 * Player-facing ranking propositions. Reads are public (the queue is part of the
 * site); submitting and backing need an account; resolving and ingesting are
 * admin-only and feed straight into the nomination queue.
 */
export const beatmapRequestRoutes = new Hono()
	.get('/', async c => c.json(await listRequests(await sessionUserId(c))))

	// Autocomplete over the ranked/loved mirror, so players pick a real 4K map.
	.get('/search', async c => {
		const q = c.req.query('q') ?? '';
		if (q.trim().length < 2) return c.json([] as Awaited<ReturnType<typeof searchManiaSets>>);
		return c.json(await searchManiaSets(q));
	})

	.post('/', requireAuth, jsonBody(beatmapRequestBody), async c => {
		const userId = c.get('userId');
		const setId = parseBeatmapsetId(c.req.valid('json').map);
		if (!setId || setId === INTRO_SET_ID) {
			throw new HTTPException(400, { message: 'That is not a beatmapset link' });
		}

		const [existing] = await db
			.select({ status: beatmapRequests.status })
			.from(beatmapRequests)
			.where(eq(beatmapRequests.setId, setId))
			.limit(1);
		if (existing) {
			throw new HTTPException(409, {
				message: existing.status === 'pending'
					? 'That map is already in the queue - back it instead'
					: 'That map has already been through the queue',
			});
		}

		const [ingested] = await db
			.select({ status: beatmapset.status })
			.from(beatmapset)
			.where(eq(beatmapset.id, setId))
			.limit(1);
		if (ingested) {
			throw new HTTPException(409, {
				message: ingested.status === 'ranked'
					? 'That map is already ranked in osu!idle'
					: 'That map is already in the nomination queue',
			});
		}

		const [open] = await db
			.select({ pending: count() })
			.from(beatmapRequests)
			.where(and(eq(beatmapRequests.userId, userId), eq(beatmapRequests.status, 'pending')));
		if (open.pending >= MAX_PENDING_REQUESTS) {
			throw new HTTPException(429, { message: `You already have ${MAX_PENDING_REQUESTS} requests waiting - wait for one to be resolved` });
		}

		const set = await resolveSet(setId);
		await db.insert(beatmapRequests).values({
			setId,
			userId,
			artist: set.artist,
			title: set.title,
			creator: set.creator,
		});
		// The requester backs their own map, so the count reads as people wanting it.
		await db.insert(beatmapRequestVotes).values({
			setId, userId,
		});

		return c.json({
			setId, ok: true,
		}, 201);
	})

	// Back a request (or take the backing away). Only while it's still open.
	.post('/:setId/support', requireAuth, async c => {
		const setId = idParam.parse(c.req.param('setId'));
		const userId = c.get('userId');

		const [request] = await db
			.select({ status: beatmapRequests.status })
			.from(beatmapRequests)
			.where(eq(beatmapRequests.setId, setId))
			.limit(1);
		if (!request) throw new HTTPException(404, { message: 'No such request' });
		if (request.status !== 'pending') {
			throw new HTTPException(409, { message: 'That request is already resolved' });
		}

		const [deleted] = await db
			.delete(beatmapRequestVotes)
			.where(and(eq(beatmapRequestVotes.setId, setId), eq(beatmapRequestVotes.userId, userId)));

		if (!deleted.affectedRows) {
			await db.insert(beatmapRequestVotes).values({
				setId, userId,
			});
		}
		return c.json({ supported: !deleted.affectedRows });
	})

	// Admin: accept or reject, with a reason players can read.
	.patch('/:setId', requireAdmin, jsonBody(beatmapRequestPatch), async c => {
		const setId = idParam.parse(c.req.param('setId'));
		const body = c.req.valid('json');

		const [res] = await db
			.update(beatmapRequests)
			.set({
				status: body.status,
				note: body.note ?? null,
				resolvedAt: body.status === 'pending' ? null : new Date(),
				resolvedBy: body.status === 'pending' ? null : c.get('userId'),
			})
			.where(eq(beatmapRequests.setId, setId));
		if (!res.affectedRows) throw new HTTPException(404, { message: 'No such request' });

		return c.json({ ok: true });
	})

	// Admin: pull the .osz from the mirror and run it through the normal ingest,
	// so an accepted request lands in the nomination queue in one click.
	.post('/:setId/ingest', requireAdmin, async c => {
		const setId = idParam.parse(c.req.param('setId'));

		const [request] = await db
			.select({ setId: beatmapRequests.setId })
			.from(beatmapRequests)
			.where(eq(beatmapRequests.setId, setId))
			.limit(1);
		if (!request) throw new HTTPException(404, { message: 'No such request' });

		try {
			const result = await ingestOsz(await downloadOsz(setId));
			await acceptRequestsForSet(setId, c.get('userId'));
			return c.json(result);
		} catch (e) {
			throw new HTTPException(400, { message: e instanceof Error ? e.message : 'Could not ingest that beatmap' });
		}
	})

	// The requester can withdraw an open request; an admin can drop any of them.
	.delete('/:setId', requireAuth, async c => {
		const setId = idParam.parse(c.req.param('setId'));
		const userId = c.get('userId');

		const [request] = await db
			.select({
				userId: beatmapRequests.userId, status: beatmapRequests.status,
			})
			.from(beatmapRequests)
			.where(eq(beatmapRequests.setId, setId))
			.limit(1);
		if (!request) throw new HTTPException(404, { message: 'No such request' });

		const own = request.userId === userId && request.status === 'pending';
		if (!own && !isAdmin(userId)) throw new HTTPException(403, { message: 'Forbidden' });

		await db.delete(beatmapRequestVotes).where(eq(beatmapRequestVotes.setId, setId));
		await db.delete(beatmapRequests).where(eq(beatmapRequests.setId, setId));
		return c.json({ ok: true });
	})
;

/** Who asked for each of these sets, for the nomination queue's own listing. */
export const requestersForSets = async (setIds: number[]) => {
	if (!setIds.length) return new Map<number, { userId: number; username: string }>();
	const rows = await db
		.select({
			setId: beatmapRequests.setId,
			userId: beatmapRequests.userId,
			username: users.username,
		})
		.from(beatmapRequests)
		.leftJoin(users, eq(users.id, beatmapRequests.userId))
		.where(inArray(beatmapRequests.setId, setIds));

	return new Map(rows.map(row => [row.setId, {
		userId: row.userId, username: row.username ?? 'unknown',
	}]));
};
