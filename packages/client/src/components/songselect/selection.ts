import {
	createContext,
	useContext,
} from 'react';
import Synced from '@osu-idle/shared/helpers/synced';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';
import { music } from '../../audio/MusicPlayer';
import { openPage } from '../../globals';

/**
 * Which map the carousel is on.
 *
 * The scene's carousel synchronises to `music.beatmap`, as it always has: there,
 * the selection *is* the song playing, the backdrop, and what the rest of the
 * game means by "the current map". The queue carousel is a different question -
 * which map you are about to add - so it gets its own value to synchronise to,
 * and browsing it leaves the running play, the backdrop and the result on
 * screen exactly as they were.
 *
 * Same mechanism either way; only the source differs.
 */
export const queueSelection = new Synced<LightBeatmap | undefined>(undefined);

export const SelectionContext =
	createContext<Synced<LightBeatmap | undefined>>(music.beatmap);

export const useSelection = () => useContext(SelectionContext);

/** Which value the carousel on screen is synchronised to. */
const liveSelection = () =>
	openPage.get()?.page === 'queue' ? queueSelection : music.beatmap;

/** Put the carousel on a map, without starting anything. Only the selection is
 *  touched: previewing follows it in song select. */
export const focusInCarousel = (beatmap: LightBeatmap): void => {
	const selection = liveSelection();
	if (beatmap.is(selection.get())) return;
	void selection.set(beatmap);
};
