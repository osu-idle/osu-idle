import { redis } from './redis';
import { redisKeyPrefix } from './env';
import { getOnline } from './play';

export type Stats = {
	online_hist: number[];
};

const HIST_KEY = `${redisKeyPrefix}stats:online_hist`;
/** One sample per minute, kept for a rolling day. */
const MAX_SAMPLES = 60 * 24;

/**
 * Append the current online count once per minute. Every worker runs this timer,
 * but a per-minute NX key elects a single writer, so the history gets exactly one
 * sample per minute no matter how many workers (pm2 cluster) are running. The
 * history lives in Redis, so `/stats/recent` is consistent across workers and
 * survives restarts without a local file.
 */
setInterval(async () => {
	try {
		const minute = Math.floor(Date.now() / 60000);
		const won = await redis.set(`${redisKeyPrefix}stats:tick:${minute}`, '1', 'EX', 120, 'NX');
		if (!won) return;
		await redis.rpush(HIST_KEY, String(await getOnline()));
		await redis.ltrim(HIST_KEY, -MAX_SAMPLES, -1);
	} catch (err) {
		console.error('Failed to record stats sample:', err);
	}
}, 60000);

export async function getStats(): Promise<Stats> {
	const hist = await redis.lrange(HIST_KEY, 0, -1);
	return { online_hist: hist.map(Number) };
}
