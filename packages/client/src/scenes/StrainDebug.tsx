import {
	useMemo,
	useState,
} from 'react';
import Entities from '../entity/entities';
import { analyzeBeatmap } from '../gameplay/strainDebug';
import { unstableRate } from '../gameplay/hitError';
import StrainGraph from '../gameplay/StrainGraph';
import './StrainDebug.css';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { Judgements } from '@osu-idle/shared/judgement';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { currentSkin } from '../osu/skin/Skin';

interface Props {
	beatmapInfo: LightBeatmap
	onClose: () => void
	/** launch a no-fail local play driven by the debug bot */
	onPlay: () => void
}

/**
 * Debug overlay: statically runs every character skill over the selected
 * beatmap and shows the deviance graph each one would produce (plus the
 * combined result the bot actually plays), without playing the map. Re-roll
 * re-samples the randomness.
 */
export default function StrainDebug({ beatmapInfo, onClose, onPlay }: Props) {
	const [skin] = useSynced(currentSkin);
	const [character] = useSynced(Entities.character);
	const [roll, setRoll] = useState(0);
	const beatmap = useAsync(async () => await beatmapInfo.load(), [beatmapInfo]);

	// `roll` is included so "re-roll" re-samples the analysis
	const analysis = useMemo(
		() => (character && beatmap ? analyzeBeatmap(character, beatmap) : null),
		[character, beatmap, roll],
	);

	if (!beatmap) return;

	const title = `${beatmap.metadata.artist} - ${beatmap.metadata.title}`;
	const subtitle = `[${beatmap.metadata.version}] ${beatmap.metadata.beatmapId}`;

	return (
		<div className="strain">
			<header className="strain__bar">
				<div className="strain__title">
					Strain debug - {title} <span>{subtitle}</span>
				</div>
				<div className="strain__actions">
					<button className="strain__btn" onClick={onPlay}>
						▶ play as bot
					</button>
					<button className="strain__btn" onClick={() => setRoll((r) => r + 1)}>
						↻ re-roll
					</button>
					<button className="strain__btn strain__btn--close" onClick={onClose}>
						✕ close
					</button>
				</div>
			</header>

			<div className="strain__grid">
				{analysis?.series.map((s) => (
					<div
						className={`strain__cell ${s.name === 'combined' ? 'is-combined' : ''}`}
						key={s.name}
					>
						<div className="strain__name">
							<span>
								{s.name}
								{s.level !== undefined && <i className="strain__level">Lv {s.level}</i>}
								{s.computeMs !== undefined && (
									<i className="strain__time">{s.computeMs.toFixed(1)} ms</i>
								)}
							</span>
							<span className="strain__ur">{unstableRate(s.hits).toFixed(0)} UR</span>
						</div>
						<div className="strain__stats">
							<span className="strain__score">
								{Math.round(s.score.score).toLocaleString()}
							</span>
							<span className="strain__acc">{(s.score.accuracy * 100).toFixed(2)}%</span>
							{s.xp !== undefined && <span className="strain__xp">
								+{s.xp.toLocaleString()} XP
							</span>}
							<span className="strain__judges">
								{Judgements.map((j) => (
									<i key={j} style={{ color: skin.data.judgements[j].judge }}>
										{s.score.counts[j]}
									</i>
								))}
							</span>
						</div>
						<StrainGraph 
							hits={s.hits} 
							windows={analysis.windows} 
							songEndMs={analysis.songEndMs}
							failMs={s.failMs}
							overlay={s.overlay}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
