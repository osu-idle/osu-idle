import * as ppjs from 'rosu-pp-js-web';
import { Beatmap } from 'osu-classes';
import BeatmapStore from './beatmap/beatmap_store';
import rosuReady from './rosu';
import { ScoreState } from '@osu-idle/shared/sim/scoring';

const calculatePP = async (score: ScoreState, beatmap: Beatmap): Promise<number> => {
	const osu = await BeatmapStore.getOsu(beatmap.metadata.beatmapSetId, beatmap.metadata.beatmapId);
	if (!osu) return 0;

	await rosuReady();
	return(new ppjs.Performance({
		lazer: false,

		legacyTotalScore: Math.floor(score.score),
		accuracy: score.accuracy,
		combo: score.maxCombo,

		nGeki: score.counts.MARVELOUS,
		n300: score.counts.PERFECT,
		nKatu: score.counts.GREAT,
		n100: score.counts.GOOD,
		n50: score.counts.BAD,
		misses: score.counts.MISS,
	})).calculate(new ppjs.Beatmap(osu)).pp;
};

export default calculatePP;