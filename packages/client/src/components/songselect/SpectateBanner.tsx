import {
	useEffect,
	useState,
} from 'react';
import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import accuracy from '@osu-idle/shared/display/accuracy';
import Spectate from '../../online/spectate';
import { launchPlay } from '../../scenes/launchPlay';
import { currentSkin } from '../../osu/skin/Skin';

/** Banner for a play left running in the background (quit without abort):
 *  shows its live progress and lets the player jump back in as a spectator. */
export default function SpectateBanner() {
	const [play] = useSynced(Spectate.background);
	const [skin] = useSynced(currentSkin);
	const [, setTick] = useState(0);

	// re-render every second while a play is tracked so the progress bar moves
	useEffect(() => {
		if (!play) return;
		const timer = window.setInterval(() => setTick(n => n + 1), 1000);
		return () => window.clearInterval(timer);
	}, [play]);

	if (!play) return null;
	const progress = Math.max(0, Math.min(1,
		(Date.now() - play.startedAt) / (play.endsAt - play.startedAt)));

	return (
		<button
			className="spectate-banner"
			onClick={() => launchPlay(play.beatmap)}
		>
			<div className="spectate-banner__label">
				<Trans>Your character is playing</Trans>
			</div>
			<div className="spectate-banner__map">
				{play.beatmap.set.metadata.artist} - {play.beatmap.set.metadata.title}
				<span> [{play.beatmap.metadata.version}]</span>
			</div>
			{play.accuracy !== undefined && play.grade && (
				<div className="spectate-banner__stats">
					{skin.grade(play.grade, 'spectate-banner__grade')}
					{accuracy(play.accuracy)}
				</div>
			)}
			<div className="spectate-banner__hint">
				<Trans>Click to resume spectating</Trans>
			</div>
			<div
				className="spectate-banner__progress"
				style={{ width: `${progress * 100}%` }}
			/>
		</button>
	);
}
