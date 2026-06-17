import { type ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import Leaderboard from '../leaderboard/Leaderboard';
import Dropdown from '../dropdown/Dropdown';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';
import { GroupOption, GroupOptions, SETTINGS, SortOption, SortOptions } from '../../db/settings';
import { bpm } from '@osu-idle/shared/display/num';
import { length } from '@osu-idle/shared/display/length';

/** Player-facing label for a sort/group option. The option *value* stays the
 *  raw key - comparators, the persisted setting, and grouping all branch on it -
 *  so only this display text is translated. GroupOption is the superset, so one
 *  mapping covers both dropdowns. */
function optionLabel(option: GroupOption | SortOption): ReactNode {
	switch (option) {
		case 'No Grouping': return <Trans>No Grouping</Trans>;
		case 'By Artist': return <Trans>By Artist</Trans>;
		case 'By BPM': return <Trans>By BPM</Trans>;
		case 'By Creator': return <Trans>By Creator</Trans>;
		case 'By Difficulty': return <Trans>By Difficulty</Trans>;
		case 'By Length': return <Trans>By Length</Trans>;
		case 'By Playlist': return <Trans>By Playlist</Trans>;
		case 'By Rank Achieved': return <Trans>By Rank Achieved</Trans>;
		case 'By Title': return <Trans>By Title</Trans>;
		case 'Recently Played': return <Trans>Recently Played</Trans>;
	}
}

const GROUP_OPTIONS = GroupOptions.map((v) => ({ value: v, label: optionLabel(v) }));
const SORT_OPTIONS = SortOptions.map((v) => ({ value: v, label: optionLabel(v) }));

/** Top bar: selected-difficulty metadata, the scores leaderboard, and the
 *  sort/group dropdowns. Empty (just the shape) until something is selected. */
export default function TopBar({ version, scrollSpeed, scoreView, setScoreView }: {
	version: LightBeatmap | undefined;
	scrollSpeed: number;
	scoreView: boolean;
	setScoreView: (v: boolean) => void;
}) {
	// pre-formatted so the <Trans> placeholders read by name (e.g. {totalLength})
	// in the catalog instead of positional {0}.
	const totalLength = length((version?.metadata.total_length ?? 0) / 1000);
	const bpmText = bpm(version?.metadata.bpm ?? 0);
	return (
		<header className="game__topbar">
			<svg className="game__topshape" viewBox="0 0 1000 185" preserveAspectRatio="none" aria-hidden>
				<path className="game__topshape-fill" d="M0 0 H1000 V100 H430 C300 100 288 185 270 185 H0 Z" />
				<path className="game__topshape-edge" d="M0 185 H270 C288 185 300 100 430 100 H1000" />
			</svg>
			{version && (<>
				<div className="game__topinfo">
					<div className="game__top_md-container">
						<div className="game__top_md">
							<div className="game__top_md_icon">
								<div style={{ backgroundImage: `url('${version.metadata.runtime ? '/ranked.png' : '/unknown.png' }')`}}></div>
							</div>
							<div className="game__top_md_text">
								<div className="game__top_md_title">
									{version.set.metadata.artist} - {version.set.metadata.title} [{version.metadata.version}]
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
						<button className='mobile__scores' onClick={() => setScoreView(!scoreView)}>{scoreView ? <Trans>Back</Trans> : <Trans>Show scores</Trans>}</button>

						<Leaderboard />
					</div>
				</div>
				<div className="game__topfilter">
					<div className="game__topfilter_scroll">
						{scrollSpeed} (fixed)
					</div>
					<div className="game__topfilter_sort">
						<div className='game__group'>
							<span><Trans>Group</Trans></span>
							<Dropdown value={SETTINGS.groupby} options={GROUP_OPTIONS} accent='#92c3e6' />
						</div>
						<div className='game__sort'>
							<span><Trans>Sort</Trans></span>
							<Dropdown value={SETTINGS.sortby} options={SORT_OPTIONS} accent='#aed28b' />
						</div>
					</div>
				</div>
			</>)}
		</header>
	);
}
