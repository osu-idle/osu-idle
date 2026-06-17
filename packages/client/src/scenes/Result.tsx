import DevianceGraph from '../gameplay/DevianceGraph';
import { Score } from '../db/schema/score';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import Background from './Background';
import { music } from '../audio/MusicPlayer';
import './Result.css';
import Controls from '../input/Controls';
import SceneManager, { SCENE } from './SceneManager';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import SkillXPBar from '../components/SkillXPBar';
import Character from '../db/schema/character';
import useSmoothNumber from '../animations/useSmoothNumber';
import Skin from '../osu/skin/Skin';
import { Trans } from '@lingui/react/macro';
import { Judgement, JUDGEMENT } from '@osu-idle/shared/judgement';
import { GRADE_COLORS, JUDGEMENT_COLORS } from '../gameplay/judgement';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { ScoreDTO } from '@osu-idle/shared/score';
import { useEffect, useState } from 'react';
import { flushBeatmapScores } from '../online/services/scores';
import { flushCharacter, flushCharacterStats, getCharacter } from '../online/services/characters';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Autopilot from '../gameplay/autopilot';
import { launchPlay } from './launchPlay';
import num from '@osu-idle/shared/display/num';
import { SETTINGS } from '../db/settings';

/** how long the score / judgement counts take to tick up to their final value */
const COUNT_UP_MS = 3000;

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

/** A whole number that ticks up from 0 to `value` on mount. */
function CountUp({ value }: { value: number }) {
	const shown = useSmoothNumber(value, { duration: COUNT_UP_MS, from: 0 });
	return <>{Math.round(shown)}</>;
}

export default function Result({ score, game, progression, failed }: Props) {
	const gains = progression?.filter((p) => p.gained > 0).sort((a, b) => b.gained - a.gained) ?? [];

	useEffect(() => {
		if (!gains) return;
		void flushBeatmapScores(score.beatmapId);
		void flushCharacter(score.characterId);
		void flushCharacterStats(score.characterId);
	}, [gains]);

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

	const player = useAsync(async () => score.characterId > 1 ? await getCharacter(score.characterId) : Character.get({ id: score.characterId }), [score.characterId]);

	const track = music.beatmap.use((b) => b && ({
		title: b.set.metadata.title,
		artist: b.set.metadata.artist,
		creator: b.set.metadata.creator,
		version: b.metadata.version,
	}));

	const displayScore = Math.round(score.score);
	const shownScore = useSmoothNumber(displayScore, { duration: COUNT_UP_MS, from: 0 });

	const playedAt = new Date(score.playedAt).toLocaleString(undefined, {
		dateStyle: 'medium', timeStyle: 'short',
	});
	const playerName = player?.name ?? '--';
	const ur = score.ur.toFixed(2);

	return (<>
		<Background />
		<div className="resultscreen">
			<div className="result__meta">
				<div className="result__title">
					{track ? `${track.artist} - ${track.title} ` : <Trans>Result</Trans>}
					{track && <span className="result__version">[{track.version}]</span>}
				</div>
				{track && <div className="result__creator"><Trans>Beatmap by {track.creator}</Trans></div>}
				<div className="result__played"><Trans>Played by {playerName} on {playedAt}</Trans></div>
			</div>
			<button className="result__exit" onClick={onBack}>
				<Trans>BACK</Trans>
			</button>
			{autopilot && (
				<div className="result__autopilot">
					{nextUp
						? <><Trans>Next up in {countdown}s:</Trans> {nextUp.set.metadata.artist} - {nextUp.set.metadata.title} <span>[{nextUp.metadata.version}]</span></>
						: <Trans>Autopilot: nothing playable</Trans>}
				</div>
			)}
			<div className="result">
				<div className="result__left">
					<div className="result__topleft">
						<div className="result__panel">
							<div className="result__score" style={{ textShadow: `0 0px 6px ${GRADE_COLORS[score.grade]}`}}>{Math.round(shownScore).toString().padStart(7, '0')}</div>

							<div className="result__judges">
								{JUDGE_ORDER.map((j) => (
									<div key={j} className="result__judge">
										<span className="result__judge-label" style={{ color: JUDGEMENT_COLORS[j], textShadow: `0 0px 4px ${JUDGEMENT_COLORS[j]}` }}>
											{j}
										</span>
										<span className="result__judge-count" style={{ textShadow: `0 0px 4px ${JUDGEMENT_COLORS[j]}` }}><CountUp value={score instanceof Score ? score[j] : score.judgements[j]} /></span>
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
									<span className="result__total-value">{(score.accuracy * 100).toFixed(2)}%</span>
								</div>
							</div>
						</div>
						<div className="result__progression">
							{!failed && progression && (gains.length > 0 ? (
								<div className="result__skills">
									{gains.map((p, i) => (
										<SkillXPBar key={p.skill} progress={p} delay={500 + i * 900} />
									))}
								</div>
							) : (
								<div className="result__skills-empty"><Trans>No skill gains</Trans></div>
							))}
						</div>
					</div>
					<div className="result__graphs">
						<figure className="result__graph">
							<figcaption>HP</figcaption>
							<div className="result__graph-empty">{failed && <div className="result__failed"><Trans>FAILED</Trans></div>}</div>
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
					{Skin.grade(score.grade, 'result__grade')}
				</div>

			</div>
		</div>
	</>);
}
