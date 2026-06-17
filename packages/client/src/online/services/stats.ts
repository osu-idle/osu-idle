import { rpc } from '../client';
import MemCache from '@osu-idle/shared/storage/memcache';

const endpoint = rpc.v1.stats;

export async function getVersion(): Promise<string> {
	return MemCache.get<string>('API.stats.getVersion').process(null, async () => {
		const res = await endpoint.version.$get();
		if (!res.ok) throw new Error(`API.stats.getVersion() failed: ${res.status}`);
		return await res.json();
	}, 1000 * 10);
}
