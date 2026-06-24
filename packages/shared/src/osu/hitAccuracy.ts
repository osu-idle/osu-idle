import sum from '../helpers/sum.js';
import {
	Judgements,
	type Judgement,
} from '../judgement.js';
import { ACCURACY } from '../sim/scoring.js';

const hitAccuracy = (totals: Record<Judgement, number>) => 
	sum(Judgements.map(j => ACCURACY[j] * totals[j]))
			/ Math.max(1, sum(Judgements.map(j => totals[j])));

export default hitAccuracy;