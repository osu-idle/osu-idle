import { useEffect, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import BeatmapAPI from '../osu/beatmap/beatmap_api';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import { difficultyColor } from '../osu/difficulty';
import { DownloadState } from './BeatmapCarousel';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import LightBeatmapSet from '../osu/beatmap/LightBeatmapSet';
import { music } from '../audio/MusicPlayer';
import { Score } from '../db/schema/score';
import Entities from '../entity/entities';
import Skin from '../osu/skin/Skin';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { SETTINGS } from '../db/settings';

/** max gap between two clicks on the same card to count as a double-click */
const DOUBLE_CLICK_MS = 300;

type Props = {
	beatmap: LightBeatmap,
	set: LightBeatmapSet,

	onCardClick: (beatmap: LightBeatmap, set: LightBeatmapSet) => void
	onCardDoubleClick: (beatmap: LightBeatmap, set: LightBeatmapSet) => void
	hasDownloaded: boolean

	downloads: Record<number, DownloadState>
};

export default function BeatmapCard({
	beatmap, set,
	onCardClick, onCardDoubleClick, hasDownloaded,
	downloads,
}: Props) {
	const stars = beatmap.metadata.difficulty;

	const [bg, setBg] = useState<string | undefined>(
		beatmap.metadata.runtime ? undefined : BeatmapAPI.assetUrl(beatmap.metadata.background),
	);
	useEffect(() => {
		let cancelled = false;
		BeatmapStore.getBeatmapBackground(beatmap).then((b) => { if (!cancelled) setBg(b); });
		return () => { cancelled = true; };
	}, [beatmap]);

	// Grade is per-character: re-query when the live character changes (e.g. a
	// disconnect falling back to guest, or reconnecting back to the account) so
	// the card always reflects whoever is currently signed in.
	const [character] = useSynced(Entities.character);
	const [showThumbnails] = useSynced(SETTINGS.showThumbnails);
	const grade = useAsync(async () => (await Score.best(character.id, beatmap.metadata.id))?.grade, [beatmap, character.id]);

	const version = beatmap.metadata.version;
	const artist = set.metadata.artist;
	const title = set.metadata.title;
	const creator = set.metadata.creator;

	// Detect double-click ourselves rather than using native onDoubleClick: the
	// browser fires dblclick on two clicks within its time/distance threshold
	// regardless of which card each hit, so fast clicks across different sets get
	// misread as a double-click. This ref is per-card (cards are keyed by version
	// id), so two clicks only count as a double-click on the *same* card.
	const lastClickRef = useRef(0);
	const handleClick = () => {
		const now = Date.now();
		if (now - lastClickRef.current <= DOUBLE_CLICK_MS) {
			lastClickRef.current = 0;
			onCardDoubleClick(beatmap, set);
		} else {
			lastClickRef.current = now;
			onCardClick(beatmap, set);
		}
	};

	const active = beatmap.isPlaying();
	const sibling = !active && set.is(music.beatmap.get()?.set);

	const dl = downloads[set.metadata.id];
	const downloaded = dl?.status === 'done';
	const downloading = dl?.status === 'downloading';
	const color = difficultyColor(stars);
	return (
		<div
			className={`bm-card ${active ? 'is-active' : ''} ${
				sibling ? 'is-sibling' : ''
			} ${downloaded ? 'is-downloaded' : 'is-remote'}`}
			data-id={beatmap.metadata.id}
			onClick={handleClick}
			style={bg ? { backgroundImage: showThumbnails ? `url("${bg}")` : '' } : undefined}
		>
			<div className="bm-card__scrim" />
			<div className="bm-card__inner">
				{grade && Skin.grade(grade)}
				<div className="bm-card__body">
					<div className="bm-card__title">{title}{!hasDownloaded && (<div className='bm-card__dl'>- <Trans>Double click to download</Trans></div>)}</div>
					<div className="bm-card__artist">{artist}</div>
					<div className="bm-card__meta">
						<span className="bm-card__stars" style={{ color }}>
							★ {stars.toFixed(2)}
						</span>
						<span className="bm-card__version" style={{ color }}>
							{version}
						</span>
						<span className="bm-card__creator"><Trans>mapped by {creator}</Trans></span>
					</div>
				</div>
			</div>

			{downloading && (
				<span
					className="bm-card__progress"
					style={{ width: `${Math.round((dl?.progress ?? 0) * 100)}%` }}
				/>
			)}
		</div>
	);
}
