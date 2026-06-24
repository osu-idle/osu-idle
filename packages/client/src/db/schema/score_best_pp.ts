import {
	DAO,
	integer,
	table,
} from '../dao';
import { Score } from './score';

const t = table('score_best_pp', {
	characterId: integer(),
	beatmapId:   integer(),
	scoreId:     integer(),
}, { primaryKey: ['characterId', 'beatmapId'] });

export class ScoreBestPP extends DAO(t) {

	public static fromScore(score: Score): ScoreBestPP {
		if (!score.id) 
			throw new Error('Cannot create a personal best without a score ID');

		return new ScoreBestPP({
			characterId: score.characterId,
			beatmapId:   score.beatmapId,
			scoreId:     score.id,
		});
	}

}
