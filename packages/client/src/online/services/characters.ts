import { InferResponseType } from 'hono/client';
import { rpc } from '../client';
import MemCache from '@osu-idle/shared/storage/memcache';
import Entities from '../../entity/entities';

const endpoint = rpc.v1.characters;

type CharacterResponse = InferResponseType<typeof endpoint[':id']['$get'], 200>;
type CharacterStatsResponse = InferResponseType<typeof endpoint[':id']['stats']['$get'], 200>;

const c1 = MemCache.get<CharacterResponse>('API.getCharacter');
export const flushCharacter = (id: number) => c1.delete(id);
export const getCharacter = async (id: number): Promise<CharacterResponse> => {
	const current = id === Entities.character.get().id;
	return c1.process(id, async () => {
		const res = await endpoint[':id'].$get({ param: { id: String(id) } });
		if (!res.ok) throw new Error(`getCharacter(${id}) failed: ${res.status}`);
		return res.json();
	}, 1000 * (current ? 30 : 3600));
};

const c2 = MemCache.get<CharacterStatsResponse>('API.getCharacterStats');
export const flushCharacterStats = (id: number) => c2.delete(id);
export const getCharacterStats = async (
	id: number,
): Promise<CharacterStatsResponse> => {
	const current = id === Entities.character.get().id;
	return c2.process(id, async () => {
		const res = await endpoint[':id']['stats'].$get({ param: { id: String(id) } });
		if (!res.ok) throw new Error(`getCharacterStats(${id}) failed: ${res.status}`);
		return res.json();
	}, 1000 * (current ? 30 : 3600));
};