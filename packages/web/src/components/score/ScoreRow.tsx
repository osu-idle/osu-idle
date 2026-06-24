import type { InferResponseType } from 'hono/client';
import { rpc } from '../../api/client';
import './ScoreRow.css';
import { dateAgo } from '@osu-idle/shared/display/ago';
import accuracy from '@osu-idle/shared/display/accuracy';
import num from '@osu-idle/shared/display/num';
import Grade from './Grade';

type Score = InferResponseType<(typeof rpc.v1.scores[':id'])['$get'], 200>;
type Beatmap = InferResponseType<(typeof rpc.v1.beatmap[':id'])['$get'], 200>;

export default function ScoreRow({
	score, beatmap,
}: {
	score: Score,
	beatmap: Beatmap,
}) {

	return (<div className='score__row'>
		<div className='score__top'>
			<div className='score__grade'><Grade grade={score.grade} /></div>
			<div className='score__title'>
				<div className='score__md'>{beatmap.title} by {beatmap.artist}</div>
				<div className='score__mb'><b>{beatmap.version}</b> <span>{dateAgo(score.playedAt)}</span></div>
			</div>
			<div className='score__acc'>{accuracy(score.accuracy)}</div>
		</div>
		<div className='score__bottom'>
			<div className='score__pp-flow'>
				<div className='score__pp-container'>
					<div className='score__pp'>
						{num(score.pp)}<span className="score__pp_unit">pp</span>
					</div>
				</div>
			</div>
		</div>
	</div>);
}