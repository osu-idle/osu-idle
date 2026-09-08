import Synced from '@osu-idle/shared/helpers/synced';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';

/**
 * Play a map the way clicking it in song select does.
 *
 * That path is what fills the queue: it takes the listing on screen - the open
 * group, or the whole filtered list - and arms the queue from it. Launching a
 * map on its own (the dock's fallback, spectating) starts a play with nothing
 * behind it, which is why this is worth reaching for first.
 *
 * Song select publishes it while it is mounted; it answers false when the map
 * is not in the list on screen, so the caller can fall back.
 */
export const playFromList =
	new Synced<((beatmap: LightBeatmap) => boolean) | undefined>(undefined);
