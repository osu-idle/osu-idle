import type { InferResponseType } from 'hono/client';
import { rpc } from '../client';
import MemCache from '@osu-idle/shared/storage/memcache';

const endpoint = rpc.v1.users[':id'].$get;

/** The user shape returned by the API - inferred from the server, equals UserDTO. */
export type User = InferResponseType<typeof endpoint, 200>;

/**
 * Fetch a user by id. The return type is inferred end-to-end from the server
 * route, so it always matches the API's actual response with no duplication.
 */
export async function getUser(id: number): Promise<User> {
	return MemCache.get<User>('API.getUser').process(id, async () => {
		const res = await endpoint({ param: { id: String(id) } });
		if (!res.ok) throw new Error(`getUser(${id}) failed: ${res.status}`);
		return res.json();
	}, 1000 * 3600);
}
