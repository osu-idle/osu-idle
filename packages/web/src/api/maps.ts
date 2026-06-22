import { apiUrl, json, rpc, unwrap, withAuth } from './client';
import type { BeatmapStatus } from '@osu-idle/shared/beatmap';

/** Public: live general stats (online/playing counts, totals). */
export const getRecentMaps = () =>
	unwrap(rpc.v1.beatmap.recent.$get());

export const getAllMaps = (dir?: 'asc' | 'desc') =>
	unwrap(rpc.v1.beatmap.all[':dir'].$get({ param: { dir: dir ?? 'desc' } }));

export const getPopularMaps = (dir?: 'asc' | 'desc') =>
	unwrap(rpc.v1.beatmap.popular[':dir'].$get({ param: { dir: dir ?? 'desc' } }));

// --- Beatmap nomination (admin) ---

/** Admin: the full nomination queue (pending + ranked + rejected). */
export const listNominations = () => unwrap(rpc.v1.beatmap.nomination.$get());

/** One row of the nomination queue, inferred from the route. */
export type Nomination = Awaited<ReturnType<typeof listNominations>>[number];

/** Admin: ingest an uploaded .osz into the queue as a pending set. */
export const uploadBeatmap = async (file: File) => {
	const form = new FormData();
	form.append('file', file);
	const res = await fetch(apiUrl('/v1/beatmap/nomination'), withAuth({ method: 'POST', body: form }));
	return json<{ setId: number; difficulties: number }>(res);
};

/** Admin: set the ranked date and/or status of a set. */
export const updateNomination = (setId: number, body: { rankedAt?: string | null; status?: BeatmapStatus }) =>
	unwrap(rpc.v1.beatmap.nomination[':setId'].$patch({ param: { setId: String(setId) }, json: body }));

/** Admin: drop a set (rows + files) from the queue. */
export const deleteNomination = (setId: number) =>
	unwrap(rpc.v1.beatmap.nomination[':setId'].$delete({ param: { setId: String(setId) } }));
