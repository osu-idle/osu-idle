import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import ContextMenu from '../ContextMenu';
import { type CarouselItem } from '../BeatmapCarousel';

/** The card's osu!-style right-click menu. `deleteArmed` lives here (not in the
 *  parent) so it resets to unarmed every time the menu reopens - the menu only
 *  mounts while a card is targeted.
 *
 *  Entries are not numbered: the queue ones come and go with whether the map is
 *  downloaded, so any number baked into a label is wrong half the time - and
 *  wrong in every translation of it. */
export default function CardContextMenu({ 
	item, 
	onClose, 
	onManagePlaylists, 
	onDelete, 
	onClearScores, 
	onQueue,
	onPlayNext,
}: {
	item: CarouselItem;
	onClose: () => void;
	onManagePlaylists: () => void;
	onDelete: () => void;
	onClearScores: () => void;
	onQueue: () => void;
	onPlayNext: () => void;
}) {
	const { t } = useLingui();
	// delete needs a second click to confirm (osu!-style)
	const [deleteArmed, setDeleteArmed] = useState(false);
	// only a downloaded map can be played, so only a downloaded map can be queued
	const queueOptions = item.beatmap.metadata.runtime
		? [
			{
				label: t`Add to queue`,
				color: '#ff66ab',
				onClick: onQueue,
			},
			{
				label: t`Play next`,
				color: '#ff66ab',
				onClick: onPlayNext,
			},
		]
		: [];
	return (
		<ContextMenu
			title={`${item.set.metadata.artist} - ${item.set.metadata.title}`}
			sub={t`What do you want to do with this beatmap?`}
			onClose={onClose}
			options={[
				...queueOptions,
				{ 
					label: t`Manage Playlists`, 
					color: '#85b81e', 
					onClick: onManagePlaylists, 
				},
				{ 
					label: deleteArmed ? 
						t`Click again to delete` : t`Delete...`, 
					color: '#e93100', 
					onClick: () => {
						if (deleteArmed) onDelete();
						else setDeleteArmed(true);
					},
				},
				{ 
					label: t`Clear local scores`, 
					color: '#ce7dd6', 
					onClick: onClearScores, 
				},
				{ 
					label: t`Cancel`,
					color: '#6b6b6b', 
					onClick: onClose, 
				},
			]}
		/>
	);
}
