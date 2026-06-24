import { Trans } from '@lingui/react/macro';
import { music } from '../../audio/MusicPlayer';

/** Title bar: beatmap title/version/creator (read from the live track) plus the
 *  played-by line. Falls back to a generic header when no track is loaded. */
export default function ResultMeta({ 
	playerName, 
	playedAt, 
}: { playerName: string; playedAt: string }) {
	const track = music.beatmap.use((b) => b && ({
		title: b.set.metadata.title,
		artist: b.set.metadata.artist,
		creator: b.set.metadata.creator,
		version: b.metadata.version,
	}));
	return (
		<div className="result__meta">
			<div className="result__title">
				{track ? `${track.artist} - ${track.title} ` : <Trans>Result</Trans>}
				{track && <span className="result__version">[{track.version}]</span>}
			</div>
			{track && <div className="result__creator">
				<Trans>Beatmap by {track.creator}</Trans>
			</div>}
			<div className="result__played">
				<Trans>Played by {playerName} on {playedAt}</Trans>
			</div>
		</div>
	);
}
