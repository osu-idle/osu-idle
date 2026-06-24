import { effects } from './EffectPlayer';
import type { SampleEvent } from '../osu/beatmap/storyboard';

/**
 * Look-ahead scheduler for a fixed list of timed effects-channel samples
 * (storyboard samples or note keysounds). Generalises the single-sound logic in
 * hitsounds.ts: it lays each due sample onto the audio clock so it fires on time
 * even while the tab is blurred, and drops samples already in the past instead of
 * dumping them late.
 */
export class SampleSchedule {

	private ptr = 0;

	constructor(private readonly events: SampleEvent[]) {}

	/** Schedule every sample due within `lookaheadMs` of song position `nowMs`. */
	queue(nowMs: number, lookaheadMs: number): void {
		const e = this.events;
		while (this.ptr < e.length && e[this.ptr].time <= nowMs + lookaheadMs) {
			const ev = e[this.ptr++];
			if (ev.time < nowMs) continue; // already past - skip but keep advancing
			if (!effects.isLoaded(ev.key)) continue; // asset missing - stay silent
			effects.play(ev.key, {
				atMs: effects.now() + (ev.time - nowMs), 
				volume: ev.volume,
			});
		}
	}

	/**
	 * Re-seat the pointer at song position `t` (after a seek/pause). Pair with
	 * effects.stopAll() to drop anything already queued ahead on the audio clock.
	 */
	resync(t: number): void {
		let i = 0;
		while (i < this.events.length && this.events[i].time < t) i++;
		this.ptr = i;
	}

	get length(): number {
		return this.events.length;
	}
}
