import './ScoreTooltip.css';
import { createPortal } from 'react-dom';
import { ScoreDTO } from '@osu-idle/shared/score';
import { Trans } from '@lingui/react/macro';
import { Judgement, Judgements } from '@osu-idle/shared/judgement';
import accuracy from '@osu-idle/shared/display/accuracy';
import Skin from '../../osu/skin/Skin';
import { Score } from '../../db/schema/score';
import { dateAgo } from '@osu-idle/shared/display/ago';

interface Props {
	score: Score | ScoreDTO,
	x: number,
	y: number,
}

/** Small info card that follows the mouse while a score row is hovered. Rendered
 *  in a body portal so it escapes the leaderboard's scroll clipping. The `score`
 *  is in scope here - fill in the content to taste. */
export default function ScoreTooltip({ score, x, y }: Props) {
	const date = new Date(score.playedAt).toLocaleString();
	const acc = accuracy(score.accuracy);
	const getJudge = (j: Judgement, score: Score | ScoreDTO) => 'judgements' in score ? score.judgements[j] : score[j];
	return createPortal(
		<div className="score_tooltip" style={{ left: x, top: y }}>
			<Trans>Achieved on {date} ({dateAgo(score.playedAt)})</Trans><br />
			{Judgements.map(j => <span>
				<span style={{ color: Skin.judgeColor(j)}}>{j}</span>: {getJudge(j, score)}&nbsp;
			</span>)}<br />
			<Trans>Accuracy: {acc}</Trans>
		</div>,
		document.body,
	);
}
