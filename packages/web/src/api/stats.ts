import { rpc, unwrap } from './client';

/** Public: live general stats (online/playing counts, totals). */
export const getGeneralStats = () =>
	unwrap(rpc.v1.stats.general.$get());

/** Public: recent stats, including the per-minute online-player history. */
export const getRecentStats = () =>
	unwrap(rpc.v1.stats.recent.$get());
