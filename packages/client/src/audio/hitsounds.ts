import { effects } from './EffectPlayer';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import type { SampleEvent } from '../osu/beatmap/storyboard';
import {
	currentSkin,
	HITSOUND,
} from '../osu/skin/Skin';

/**
 * The default-hitsound layer: a note with no keysound plays the default skin's
 * `normal-hitnormal` here. Keysounded notes and storyboard samples are decoded
 * from the beatmap (see storyboard.ts), preloaded via preloadSamples
 * and scheduled through SampleSchedule instead.
 *
 * Still minimal on the default path: full osu hitsounding (whistle/finish/clap
 * additions, normal/soft/drum sample sets, per-timing-point sample changes)
 * slot in here by resolving the right default key(s) per note from the beatmap.
 */

/** Decode the default skin's hitsounds so they can be played with no latency. */
export function preloadDefaultHitsounds(): Promise<void> {
	return effects.preload(currentSkin.get().data.hitSounds);
}

/**
 * Decode a set's sample blobs (keysounds / storyboard samples) into the effects
 * player, keyed by their stable asset key, so they can be scheduled with no
 * latency. De-duplicated by key; already-loaded and missing files are skipped.
 */
export async function preloadSamples(
	setId: number, 
	events: SampleEvent[],
): Promise<void> {
	const unique = new Map<string, string>();
	for (const ev of events) if (!unique.has(ev.key)) unique.set(ev.key, ev.file);
	await Promise.all([...unique].map(async ([key, file]) => {
		if (effects.isLoaded(key)) return;
		const url = await BeatmapStore.getSampleUrl(setId, file);
		if (url) await effects.load(key, url);
	}));
}

/** Play the hitsound(s) for a landed hit, now. */
export function playHitsound(): void {
	effects.play(currentSkin.get().data.hitSounds[HITSOUND.NORMAL]);
}

/**
 * Schedule the hitsound(s) for a hit at song time `songMs`, given the song's
 * current playback position `nowMs`. The lead (`songMs - nowMs`) is laid onto
 * the audio clock so it fires sample-accurately even if the JS loop is throttled
 * (e.g. a backgrounded tab). Hits already in the past (`songMs < nowMs`) are
 * dropped rather than played late.
 */
export function scheduleHitsound(songMs: number, nowMs: number): void {
	if (songMs < nowMs) return;
	effects.play(HITSOUND.NORMAL, { atMs: effects.now() + (songMs - nowMs) });
}

/** Drop every hitsound already queued on the audio clock. Called when a play ends
 *  early on fail so look-ahead-scheduled hits don't keep firing past the fail. */
export function stopScheduledHitsounds(): void {
	effects.stopAll();
}
