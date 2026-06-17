import Synced from '@osu-idle/shared/helpers/synced';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { t } from '@lingui/core/macro';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

export const AutopilotModes = [
	'PLAYLIST',
	'NEXT',
	'LOOP'
] as const;
export const AUTOPILOT_MODE = mapped(AutopilotModes);
export type AutopilotMode = ValueIn<typeof AUTOPILOT_MODE>;

export const autopilotModeLabels = (): Record<AutopilotMode, string> => ({
	[AUTOPILOT_MODE.PLAYLIST]: t`Playlist`,
	[AUTOPILOT_MODE.NEXT]: t`Next song`,
	[AUTOPILOT_MODE.LOOP]: t`Loop`,
});

export interface AutopilotSession {
	/** the source group/song name, for display */
	playlist: string;
	/** the captured difficulties, in the order they were shown */
	entries: LightBeatmap[];
	/** index (into entries) of the map currently being played */
	index: number;
}

/**
 * Autopilot. Launching a map arms a session whose entries depend on the chosen
 * mode (see SongSelect's `play`): LOOP captures just that one map, NEXT the
 * song-select order, PLAYLIST the launched playlist group. The result screen
 * then chains into the next playable entry (wrapping) after a short countdown,
 * looping until the player leaves. Song select stops any session on mount -
 * that single rule covers every manual exit (quitting gameplay, backing out of
 * the result, a failed launch), since they all land back there.
 */
export default class Autopilot {

	public static session = new Synced<AutopilotSession | null>(null);

	public static start(playlist: string, entries: LightBeatmap[], index: number): void {
		void this.session.set({ playlist, entries, index });
	}

	public static stop(): void {
		if (this.session.get()) void this.session.set(null);
	}

	/** Peek at the next playable entry without moving the session. */
	public static next(): LightBeatmap | null {
		return this.findNext()?.beatmap ?? null;
	}

	/** Move the session onto the next playable entry and return it; stops the
	 *  session (and returns null) when nothing in the playlist is playable. */
	public static advance(): LightBeatmap | null {
		const found = this.findNext();
		if (!found) {
			this.stop();
			return null;
		}
		const s = this.session.get()!;
		void this.session.set({ ...s, index: found.index });
		return found.beatmap;
	}

	/** The next *downloaded* entry after the current index, wrapping. Entries
	 *  that aren't downloaded can't be played, so they're skipped; a single-entry
	 *  session (e.g. LOOP) loops onto itself (step = length). */
	private static findNext(): { beatmap: LightBeatmap, index: number } | null {
		const s = this.session.get();
		if (!s || s.entries.length === 0) return null;
		for (let step = 1; step <= s.entries.length; step++) {
			const i = (s.index + step) % s.entries.length;
			if (s.entries[i].metadata.runtime) return { beatmap: s.entries[i], index: i };
		}
		return null;
	}
}
