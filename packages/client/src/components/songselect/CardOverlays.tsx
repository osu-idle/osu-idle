import { type CarouselItem } from '../BeatmapCarousel';
import CardContextMenu from './CardContextMenu';
import PlaylistOverlay from '../PlaylistOverlay';
import PlayQueue from '../../gameplay/playQueue';

type Props = {
	/** the right-clicked card's menu target */
	menuItem: CarouselItem | null;
	/** the card whose playlist membership is being edited */
	playlistItem: CarouselItem | null;
	/** where a queued map came from, for the queue's label */
	queueLabel: string;
	onCloseMenu: () => void;
	onManagePlaylists: () => void;
	onClosePlaylists: () => void;
	onDelete: () => void;
	onClearScores: () => void;
};

/** Everything a right-clicked card can open: its menu, and the playlist manager
 *  that menu leads to. Kept together so the scene carries one element. */
export default function CardOverlays({
	menuItem,
	playlistItem,
	queueLabel,
	onCloseMenu,
	onManagePlaylists,
	onClosePlaylists,
	onDelete,
	onClearScores,
}: Props) {
	return (<>
		{menuItem && (
			<CardContextMenu
				item={menuItem}
				onClose={onCloseMenu}
				onQueue={() => {
					PlayQueue.append(menuItem.beatmap, queueLabel);
					onCloseMenu();
				}}
				onPlayNext={() => {
					PlayQueue.playNext(menuItem.beatmap, queueLabel);
					onCloseMenu();
				}}
				onManagePlaylists={onManagePlaylists}
				onDelete={onDelete}
				onClearScores={onClearScores}
			/>
		)}
		{playlistItem && (
			<PlaylistOverlay
				beatmap={playlistItem.beatmap}
				onClose={onClosePlaylists}
			/>
		)}
	</>);
}
