import DevianceGraph from '../gameplay/DevianceGraph';
import { Score } from '../db/schema/score';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import Background from './Background';
import './Result.css';
import Controls from '../input/Controls';
import SceneManager, { SCENE } from './SceneManager';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import Character from '../db/schema/character';
import useSmoothNumber from '../animations/useSmoothNumber';
import { currentSkin } from '../osu/skin/Skin';
import { Trans } from '@lingui/react/macro';
import {
	Judgement,
	JUDGEMENT,
} from '@osu-idle/shared/judgement';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { ScoreDTO } from '@osu-idle/shared/score';
import { useEffect } from 'react';
import { flushBeatmapScores } from '../online/services/scores';
import {
	flushCharacter,
	flushCharacterStats,
	getCharacter,
} from '../online/services/characters';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import num from '@osu-idle/shared/display/num';
import CountUp, { COUNT_UP_MS } from '../components/result/CountUp';
import ResultMeta from '../components/result/ResultMeta';
import SkillProgression from '../components/result/SkillProgression';
import { currentScore } from '../globals';
import { showsDivine } from '@osu-idle/shared/rebirth';

/** Two per row. Divine pairs with marvelous at the top and pushes perfect down
 *  beside great; without divine the pairing is left exactly as it was. */
const JUDGE_ORDER: Judgement[] = [
	JUDGEMENT.PERFECT, JUDGEMENT.MARVELOUS,
	JUDGEMENT.GREAT, JUDGEMENT.GOOD,
	JUDGEMENT.BAD, JUDGEMENT.MISS,
];

const DIVINE_JUDGE_ORDER: Judgement[] = [
	JUDGEMENT.DIVINE, JUDGEMENT.MARVELOUS,
	JUDGEMENT.PERFECT, JUDGEMENT.GREAT,
	JUDGEMENT.GOOD, JUDGEMENT.BAD,
	JUDGEMENT.MISS,
];

const judgeOrder = (divineCount: number): Judgement[] =>
	showsDivine(divineCount) ? DIVINE_JUDGE_ORDER : JUDGE_ORDER;

type Props = {
	score: Score | ScoreDTO,
	game?: ManiaGame,
	/** per-skill XP progression to show (local play computes it, ranked play gets
	 *  it from the server); omitted when the play awards no XP */
	progression?: SkillProgress[],
	/** the play failed (HP hit 0): the score was not saved and awards no XP */
	failed?: boolean,
	/** the map this score is of. Given, the screen names it itself instead of
	 *  following the live selection, which browsing elsewhere can change. */
	beatmap?: LightBeatmap,
};

export default function Result({ score, game, progression, failed, beatmap }: Props) {
	const [skin] = useSynced(currentSkin);

	const count = (j: Judgement): number =>
		score instanceof Score ? score[j] : score.judgements[j];

	const gains = progression
		?.filter((p) => p.gained > 0)
		.sort((a, b) => b.gained - a.gained) ?? [];

	useEffect(() => {
		if (!gains) return;
		void flushBeatmapScores(score.beatmapId);
		void flushCharacter(score.characterId);
		void flushCharacterStats(score.characterId);
	}, [gains]);

	useEffect(() => {
		currentScore.set(score);
		return () => { currentScore.set(undefined); };
	}, []);

	// leaving the result screen no longer stops anything: the queue runs whether
	// or not a scene is watching it (stop it from the dock instead)
	const onBack = () => SceneManager.set(SCENE.SELECT);
	Controls.back.usePress(onBack);

	const player = useAsync(async () => Character.isLocalId(score.characterId)
		? Character.get({ id: score.characterId })
		: await getCharacter(score.characterId), [score.characterId]);

	const displayScore = Math.round(score.score);
	const shownScore = useSmoothNumber(displayScore, { 
		duration: COUNT_UP_MS, 
		from: 0, 
	});

	const playedAt = new Date(score.playedAt).toLocaleString(undefined, {
		dateStyle: 'medium', timeStyle: 'short',
	});
	const playerName = player?.name ?? '--';
	const ur = score.ur.toFixed(2);

	return (<>
		<Background beatmap={beatmap} />
		<div className="resultscreen">
			<ResultMeta playerName={playerName} playedAt={playedAt} beatmap={beatmap} />
			<button className="result__exit" onClick={onBack}>
				<Trans>BACK</Trans>
			</button>
			<div className="result">
				<div className="result__left">
					<div className="result__topleft">
						<div className="result__panel">
							<div className="result__score">
								{Math.round(shownScore).toString().padStart(7, '0')}
							</div>

							<div className="result__judges">
								{judgeOrder(count(JUDGEMENT.DIVINE)).map((j) => (
									<div key={j} className="result__judge">
										<span 
											className="result__judge-label" 
											style={{
												color: skin.data.judgements[j].judge, 
												textShadow: `0 0px 4px ${skin.data.judgements[j].judge}`, 
											}}>
											{skin.data.judgements[j].text}
										</span>
										<span 
											className="result__judge-count" 
											style={{ textShadow: `0 0px 4px ${skin.data.judgements[j].judge}` }}>
											<CountUp value={count(j)} 
											/></span>
									</div>
								))}
							</div>

							<div className="result__totals">
								<div className="result__total">
									<span className="result__total-label"><Trans>Performance</Trans></span>
									<span className="result__total-value">
										{num(score.pp)}pp
									</span>
								</div>
								<div className="result__total">
									<span className="result__total-label"><Trans>Combo</Trans></span>
									<span className="result__total-value">
										{score.maxCombo}x{score.pfc && <em className="result__pfc"> PFC</em>}
									</span>
								</div>
								<div className="result__total">
									<span className="result__total-label"><Trans>Accuracy</Trans></span>
									<span className="result__total-value">
										{(score.accuracy * 100).toFixed(2)}%
									</span>
								</div>
							</div>
						</div>
						<div className="result__progression">
							<SkillProgression failed={failed} progression={progression} gains={gains} />
						</div>
					</div>
					<div className="result__graphs">
						<figure className="result__graph">
							<figcaption>HP</figcaption>
							<div className="result__graph-empty">{failed && <div className="result__failed">
								<Trans>FAILED</Trans>
							</div>}</div>
						</figure>
						<figure className="result__graph">
							<figcaption><Trans>Hit deviance · {ur} UR</Trans></figcaption>
							{game
								? <DevianceGraph game={game} height={240} />
								: <div className="result__graph-empty"><Trans>No replay data</Trans></div>}
						</figure>
					</div>
				</div>

				<div className="result__right">
					{skin.grade(score.grade, 'result__grade')}
				</div>

			</div>
		</div>
	</>);
}
