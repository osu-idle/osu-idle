import {
	DAO,
	integer,
	table,
} from '../dao';
import { Score } from './score';

const t = table('score_best', {
	characterId: integer(),
	beatmapId:   integer(),
	scoreId:     integer(),
}, { primaryKey: ['characterId', 'beatmapId'] });

export class ScoreBest extends DAO(t) {

	public static fromScore(score: Score): ScoreBest {
		if (!score.id) 
			throw new Error('Cannot create a personal best without a score ID');
		return new ScoreBest({
			characterId: score.characterId,
			beatmapId:   score.beatmapId,
			scoreId:     score.id,
		});
	}

}
