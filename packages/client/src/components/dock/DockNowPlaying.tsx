import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import accuracy from '@osu-idle/shared/display/accuracy';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';
import { currentSkin } from '../../osu/skin/Skin';
import useTick from './useTick';

/** What the character is playing right now, or what it is waiting to play. */
export default function DockNowPlaying() {
	const [live] = useSynced(PlayManager.live);
	const [countdown] = useSynced(PlayManager.countdown);
	const [queue] = useSynced(PlayQueue.state);
	const [paused] = useSynced(PlayManager.paused);
	const [skin] = useSynced(currentSkin);
	useTick(!!live);

	// what follows, on one line: it is the only part of the queue the panel shows
	// until you actually reach for it
	const next = queue ? PlayQueue.next() : undefined;
	const upNext = next && (
		<div className="dock__upnext">
			{paused
				? <Trans>Paused, next:</Trans>
				: countdown === undefined
					? <Trans>Next:</Trans>
					: <Trans>Next in {countdown}s:</Trans>}
			{' '}{next.set.metadata.artist} - {next.set.metadata.title}
			<span> [{next.metadata.version}]</span>
		</div>
	);

	// nothing running: the line about what follows is the only thing worth
	// saying, and when there is nothing following either, say nothing
	if (!live) return upNext ?? null;

	const progress = Math.max(0, Math.min(1,
		(Date.now() - live.startedAt) / (live.endsAt - live.startedAt)));

	return (<>
		<div className="dock__now">
			<div>
				<div className="dock__map">
					{live.beatmap.set.metadata.artist} - {live.beatmap.set.metadata.title}
					<span> [{live.beatmap.metadata.version}]</span>
				</div>
				<div className="dock__sub">
					{live.accuracy !== undefined && `${accuracy(live.accuracy)} · `}
					{Math.round(progress * 100)}%
				</div>
				<div className="dock__progress">
					<b style={{ width: `${progress * 100}%` }} />
				</div>
			</div>
			{live.grade && skin.grade(live.grade, 'dock__grade')}
		</div>
		{upNext}
	</>);
}
