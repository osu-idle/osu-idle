import { InferResponseType } from 'hono/client';
import { rpc } from '../client';
import MemCache from '@osu-idle/shared/storage/memcache';
import Character from '../../db/schema/character';
import { Score } from '../../db/schema/score';

const endpoint = rpc.v1.scores;

type ScoreResponse = InferResponseType<typeof endpoint[':id']['$get'], 200>;
type BeatmapScoresResponse = InferResponseType<typeof endpoint['beatmap'][':beatmap']['$get'], 200>;

export const getScore = async (id: number): Promise<ScoreResponse> => {
	const res = await endpoint[':id'].$get({ param: { id: String(id) } });
	if (!res.ok) throw new Error(`getScore(${id}) failed: ${res.status}`);
	return res.json();
};

export const flushBeatmapScores = async (beatmap: number) => MemCache.get<BeatmapScoresResponse>('API.getBeatmapScores').delete(beatmap);
export const getBeatmapScores = async (beatmap: number): Promise<BeatmapScoresResponse> => {
	return MemCache.get<BeatmapScoresResponse>('API.getBeatmapScores').process(beatmap, async () => {
		const res = await endpoint['beatmap'][':beatmap'].$get({ param: { beatmap: String(beatmap) } });
		if (!res.ok) throw new Error(`getBeatmapScores(${beatmap}) failed: ${res.status}`);
		const scores: BeatmapScoresResponse = await res.json();

		(async () => {
			for (const score of scores) {
				const char = await Character.get(score.characterId);
				if (!char) continue;
				const local = await Score.getByOnlineId(score.id);
				if (local) continue;
				Score.fromDTO(score).add();
			}
		})();

		return scores;
	}, 1000 * 60);
};