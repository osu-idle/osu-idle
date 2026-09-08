import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';
import SceneManager, { SCENE } from '../../scenes/SceneManager';
import { launchPlay } from '../../scenes/launchPlay';
import { playFromList } from '../songselect/listPlay';
import { focusInCarousel } from '../songselect/selection';

/**
 * Find the map, then watch it.
 *
 * In front of a carousel what you usually want is to see the map among your own
 * - to queue what should follow it - so it plays it the way the list does,
 * which is what arms the queue from what is on screen. A running play is joined
 * rather than restarted. Only when the map is not in the list does it fall back
 * to spectating it alone, with nothing queued behind it.
 *
 * With nothing running there is nothing to watch, but the map that plays next is
 * still worth finding; starting it is the queue's business, not this button's.
 */
export default function DockWatchButton() {
	const { t } = useLingui();
	const [live] = useSynced(PlayManager.live);
	const [queue] = useSynced(PlayQueue.state);
	const [scene] = useSynced(SceneManager.current);

	const target = live?.beatmap ?? (queue ? PlayQueue.next() : undefined);
	// in gameplay you are already watching it
	if (!target || scene === SCENE.GAME) return null;

	const press = () => {
		if (!live) {
			focusInCarousel(target);
			return;
		}
		if (playFromList.get()?.(live.beatmap)) return;
		launchPlay(live.beatmap);
	};

	return (
		<button
			type="button"
			className="dock__btn"
			title={live
				? t`Watch it, from the list so the queue fills`
				: t`Find the map playing next`}
			onClick={press}
		>
			<Trans>watch</Trans>
		</button>
	);
}
