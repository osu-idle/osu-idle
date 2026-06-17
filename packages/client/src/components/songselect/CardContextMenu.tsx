import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import ContextMenu from '../ContextMenu';
import { type CarouselItem } from '../BeatmapCarousel';

/** The card's osu!-style right-click menu. `deleteArmed` lives here (not in the
 *  parent) so it resets to unarmed every time the menu reopens - the menu only
 *  mounts while a card is targeted. */
export default function CardContextMenu({ item, onClose, onManagePlaylists, onDelete, onClearScores }: {
	item: CarouselItem;
	onClose: () => void;
	onManagePlaylists: () => void;
	onDelete: () => void;
	onClearScores: () => void;
}) {
	const { t } = useLingui();
	// delete needs a second click to confirm (osu!-style)
	const [deleteArmed, setDeleteArmed] = useState(false);
	return (
		<ContextMenu
			title={`${item.set.metadata.artist} - ${item.set.metadata.title}`}
			sub={t`What do you want to do with this beatmap?`}
			onClose={onClose}
			options={[
				{ label: t`1. Manage Playlists`, color: '#85b81e', onClick: onManagePlaylists },
				{ label: deleteArmed ? t`2. Click again to delete` : t`2. Delete...`, color: '#e93100', onClick: () => { if (deleteArmed) onDelete(); else setDeleteArmed(true); } },
				{ label: t`3. Clear local scores`, color: '#ce7dd6', onClick: onClearScores },
				{ label: t`4. Cancel`, color: '#6b6b6b', onClick: onClose },
			]}
		/>
	);
}
