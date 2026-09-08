import { Trans } from '@lingui/react/macro';
import { bpm } from '@osu-idle/shared/display/num';
import { length } from '@osu-idle/shared/display/length';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';
import Leaderboard from '../leaderboard/Leaderboard';

/** The selected difficulty's details and its scores - the top bar's left and
 *  right halves. Drawn only by the scene: over a running play, neither belongs
 *  on screen. */
export default function BeatmapInfo({
	version,
	scoreView,
	setScoreView,
}: {
	version: LightBeatmap;
	scoreView: boolean;
	setScoreView: (v: boolean) => void;
}) {
	// pre-formatted so the <Trans> placeholders read by name (e.g. {totalLength})
	// in the catalog instead of positional {0}.
	const totalLength = length(version.metadata.total_length / 1000);
	const bpmText = bpm(version.metadata.bpm);
	const title = `${version.set.metadata.artist} - ${version.set.metadata.title} [${version.metadata.version}]`;
	const icon = `url('${version.metadata.runtime ? '/ranked.png' : '/unknown.png'}')`;

	return (
		<div className="game__topinfo">
			<div className="game__top_md-container">
				<div className="game__top_md">
					<div className="game__top_md_icon">
						<div style={{ backgroundImage: icon }}></div>
					</div>
					<div className="game__top_md_text">
						<div className="game__top_md_title">
							{title}
						</div>
						<div className="game__top_md_creator">
							<Trans>Mapped by {version.set.metadata.creator}</Trans>
						</div>
					</div>
				</div>
				<div className="game__top_version">
					<div className="game__top_music">
						<Trans>Length: {totalLength} BPM: {bpmText} Objects: {version.metadata.objects}</Trans>
					</div>
					<div className="game__top_hos">
						<Trans>Rice: {version.metadata.rice} LN: {version.metadata.ln}</Trans>
					</div>
					<div className="game__top_diff">
						<Trans>Star Rating: {version.metadata.difficulty}★</Trans>
					</div>
				</div>
			</div>
			<div className="game__top_lb-container">
				<button
					className='mobile__scores'
					onClick={() => setScoreView(!scoreView)}
				>
					{scoreView ? <Trans>Back</Trans> : <Trans>Show scores</Trans>}
				</button>

				<Leaderboard />
			</div>
		</div>
	);
}
