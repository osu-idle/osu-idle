import type { InferResponseType } from 'hono/client';
import { rpc } from '../client';
import MemCache from '@osu-idle/shared/storage/memcache';

const endpoint = rpc.v1.news;

/** The user shape returned by the API - inferred from the server, equals UserDTO. */
export type News = InferResponseType<typeof endpoint.latest.$get, 200>;

/**
 * Fetch a user by id. The return type is inferred end-to-end from the server
 * route, so it always matches the API's actual response with no duplication.
 */
export async function getLatest(): Promise<News> {
	return MemCache.get<News>('API.News.getLatest').process('latest', async () => {
		const res = await endpoint.latest.$get();
		if (!res.ok) throw new Error(`News.getLatest() failed: ${res.status}`);
		return res.json();
	}, 1000 * 300);
}
