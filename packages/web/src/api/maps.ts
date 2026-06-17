import { rpc, unwrap } from './client';

/** Public: live general stats (online/playing counts, totals). */
export const getRecentMaps = () =>
	unwrap(rpc.v1.beatmap.recent.$get());
	
export const getAllMaps = (dir?: 'asc' | 'desc') =>
	unwrap(rpc.v1.beatmap.all[':dir'].$get({ param: { dir: dir ?? 'desc' } }));
	
export const getPopularMaps = (dir?: 'asc' | 'desc') =>
	unwrap(rpc.v1.beatmap.popular[':dir'].$get({ param: { dir: dir ?? 'desc' } }));