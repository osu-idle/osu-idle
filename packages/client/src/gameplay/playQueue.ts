import Synced from '@osu-idle/shared/helpers/synced';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { t } from '@lingui/core/macro';
import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';

export const AutopilotModes = [
	'PLAYLIST',
	'NEXT',
	'SHUFFLE',
	'LOOP',
] as const;
export const AUTOPILOT_MODE = mapped(AutopilotModes);
export type AutopilotMode = ValueIn<typeof AUTOPILOT_MODE>;

export const autopilotModeLabels = (): Record<AutopilotMode, string> => ({
	[AUTOPILOT_MODE.PLAYLIST]: t`Playlist`,
	[AUTOPILOT_MODE.NEXT]: t`Next song`,
	[AUTOPILOT_MODE.SHUFFLE]: t`Shuffle`,
	[AUTOPILOT_MODE.LOOP]: t`Loop`,
});

export type QueueState = {
	/** the source group/playlist name, for display */
	label: string;
	/** what is waiting to play, in play order. The head is what plays next. */
	entries: LightBeatmap[];
	/** re-randomise the order after each map instead of following it */
	shuffle: boolean;
};

/** Fisher-Yates, on a copy. */
const shuffled = (entries: LightBeatmap[]): LightBeatmap[] => {
	const out = [...entries];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

/** Only a downloaded map can be played, so only a downloaded map can wait in
 *  the queue - that is what keeps "the head is next" honest. */
const playable = (entries: LightBeatmap[]): LightBeatmap[] =>
	entries.filter(e => e.metadata.runtime);

/**
 * What the character plays next, and after that.
 *
 * The queue is exactly what it looks like: a list of maps waiting, and the one
 * at the top is the one that plays next. Reordering it changes what happens
 * next, immediately - otherwise ordering it would be decoration. The map that
 * is *playing* is not in here; it is the live play (see PlayManager).
 *
 * It cycles rather than draining: a map that finishes goes to the back, so a
 * playlist loops the way autopilot always has. Emptying it is what stops the
 * loop - "stop after this play".
 *
 * It is deliberately **not stored**: it lives in memory and dies with the tab,
 * like a local play. A queue worth keeping is saved as a playlist.
 */
export default class PlayQueue {

	public static state = new Synced<QueueState | undefined>(undefined);

	/**
	 * Fill the queue from a pool, with `index` the map being launched right now:
	 * it drops to the back, and everything after it comes first.
	 */
	public static start(
		label: string,
		pool: LightBeatmap[],
		index: number,
		shuffle = false,
	): void {
		const launched = pool[index];
		const rest = playable([
			...pool.slice(index + 1),
			...pool.slice(0, index),
		]);
		// the launched map comes round again at the back, so a single-map queue
		// (LOOP) repeats and a playlist wraps
		const entries = launched?.metadata.runtime ? [...rest, launched] : rest;
		void this.state.set({
			label,
			entries: shuffle ? shuffled(entries) : entries,
			shuffle,
		});
	}

	public static stop(): void {
		if (this.state.get()) void this.state.set(undefined);
	}

	/** What plays next: the head of the queue, always. */
	public static next(): LightBeatmap | undefined {
		return this.state.get()?.entries[0];
	}

	/**
	 * Move the map that just started to the back, so the queue cycles. Shuffling
	 * reorders what is left and *then* puts it back, so the map that just played
	 * cannot come round again immediately.
	 *
	 * `played` names it rather than assuming it is still the head: starting takes
	 * a round trip or a whole simulation, and editing the queue meanwhile is the
	 * point of the feature. One that has been removed in that window rotates
	 * nothing - the queue is already what the player wants.
	 */
	public static advance(played?: LightBeatmap): LightBeatmap | undefined {
		const s = this.state.get();
		if (!s) {
			this.stop();
			return undefined;
		}
		const at = played ? s.entries.findIndex(e => e.is(played)) : 0;
		const entry = at < 0 ? undefined : s.entries[at];
		if (!entry) {
			if (!played) this.stop();
			return undefined;
		}
		const rest = s.entries.filter((_, i) => i !== at);
		void this.state.set({
			...s, entries: [...(s.shuffle ? shuffled(rest) : rest), entry],
		});
		return entry;
	}

	/** Add to the back. Starts a queue if there is none, so adding one map from
	 *  an idle client is enough to have something to play. */
	public static append(beatmap: LightBeatmap, label = ''): void {
		const s = this.state.get();
		if (!s) {
			void this.state.set({
				label, entries: playable([beatmap]), shuffle: false,
			});
			return;
		}
		this.set(s, [...s.entries, beatmap]);
	}

	/** Put a map at the head, where it plays next. */
	public static playNext(beatmap: LightBeatmap, label = ''): void {
		const s = this.state.get();
		if (!s) {
			this.append(beatmap, label);
			return;
		}
		// by difficulty, not by instance: the library hands out fresh objects
		// whenever it reloads, and two of them are the same map
		this.set(s, [beatmap, ...s.entries.filter(e => !e.is(beatmap))]);
	}

	public static remove(at: number): void {
		const s = this.state.get();
		if (!s) return;
		this.set(s, s.entries.filter((_, i) => i !== at));
	}

	/** Reorder. Moving something to 0 is how "play this next" is expressed. */
	public static move(from: number, to: number): void {
		const s = this.state.get();
		if (!s || from === to) return;
		const entries = [...s.entries];
		const [moved] = entries.splice(from, 1);
		if (!moved) return;
		entries.splice(Math.max(0, Math.min(entries.length, to)), 0, moved);
		this.set(s, entries);
	}

	/** Empty the queue. The running play is not touched - it finishes, and then
	 *  there is nothing behind it. */
	public static clear(): void {
		const s = this.state.get();
		if (!s) return;
		this.set(s, []);
	}

	/** An edit never re-randomises what the player just arranged - shuffle only
	 *  reorders when a map actually finishes. */
	private static set(s: QueueState, entries: LightBeatmap[]): void {
		void this.state.set({
			...s, entries: playable(entries),
		});
	}
}
