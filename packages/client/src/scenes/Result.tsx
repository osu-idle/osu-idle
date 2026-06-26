import DevianceGraph from '../gameplay/DevianceGraph';
import { Score } from '../db/schema/score';
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
import {
	useEffect,
	useState,
} from 'react';
import { flushBeatmapScores } from '../online/services/scores';
import {
	flushCharacter,
	flushCharacterStats,
	getCharacter,
} from '../online/services/characters';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Autopilot from '../gameplay/autopilot';
import { launchPlay } from './launchPlay';
import num from '@osu-idle/shared/display/num';
import { SETTINGS } from '../db/settings';
import CountUp, { COUNT_UP_MS } from '../components/result/CountUp';
import ResultMeta from '../components/result/ResultMeta';
import SkillProgression from '../components/result/SkillProgression';
import { currentScore } from '../globals';

const JUDGE_ORDER: Judgement[] = [
	JUDGEMENT.PERFECT, JUDGEMENT.MARVELOUS,
	JUDGEMENT.GREAT, JUDGEMENT.GOOD,
	JUDGEMENT.BAD, JUDGEMENT.MISS,
];

type Props = {
	score: Score | ScoreDTO,
	game?: ManiaGame,
	/** per-skill XP progression to show (local play computes it, ranked play gets
	 *  it from the server); omitted when the play awards no XP */
	progression?: SkillProgress[],
	/** the play failed (HP hit 0): the score was not saved and awards no XP */
	failed?: boolean,
};

export default function Result({ score, game, progression, failed }: Props) {
	const [skin] = useSynced(currentSkin);

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

	const onBack = () => {
		// leaving the result screen by hand ends the playlist automation
		Autopilot.stop();
		SceneManager.set(SCENE.SELECT);
	};
	Controls.back.usePress(onBack);

	// playlist autopilot: after a short countdown, chain into the next playable
	// entry of the playlist (wrapping around). Unmounting cancels the timer.
	const [autopilot] = useSynced(Autopilot.session);
	const nextUp = autopilot ? Autopilot.next() : null;
	const autopilotDelay = SETTINGS.autopilotDelay.get();
	const [countdown, setCountdown] = useState(Math.round(autopilotDelay));
	useEffect(() => {
		if (!autopilot) return;
		const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
		const launch = setTimeout(() => {
			const next = Autopilot.advance();
			if (next) launchPlay(next);
		}, autopilotDelay * 1000);
		return () => { clearInterval(tick); clearTimeout(launch); };
	}, [autopilot]);

	const player = useAsync(async () => score.characterId > 1 ? 
		await getCharacter(score.characterId) 
		: Character.get({ id: score.characterId }), [score.characterId]);

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

	const next = `${nextUp?.set.metadata.artist} - ${nextUp?.set.metadata.title}`;

	return (<>
		<Background />
		<div className="resultscreen">
			<ResultMeta playerName={playerName} playedAt={playedAt} />
			<button className="result__exit" onClick={onBack}>
				<Trans>BACK</Trans>
			</button>
			{autopilot && (
				<div className="result__autopilot">
					{nextUp
						? <>
							<Trans>Next up in {countdown}s:</Trans> {next}
							<span>[{nextUp.metadata.version}]</span>
						</>
						: <Trans>Autopilot: nothing playable</Trans>}
				</div>
			)}
			<div className="result">
				<div className="result__left">
					<div className="result__topleft">
						<div className="result__panel">
							<div className="result__score">
								{Math.round(shownScore).toString().padStart(7, '0')}
							</div>

							<div className="result__judges">
								{JUDGE_ORDER.map((j) => (
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
											<CountUp value={score instanceof Score ? score[j] : score.judgements[j]} 
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
