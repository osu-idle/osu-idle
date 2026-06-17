import { effects } from './EffectPlayer';

/**
 * The hitsound layer: maps gameplay hits to sample keys and triggers them on
 * the {@link EffectPlayer}.
 *
 * Right now this is deliberately minimal - every hit plays the default skin's
 * `normal-hitnormal`. Full osu hitsounding (whistle/finish/clap additions,
 * normal/soft/drum sample sets, per-object and per-timing-point sample changes,
 * and beatmap-bundled custom samples) will slot in here: expand the sample
 * registry and resolve the right key(s) per note from the beatmap data.
 */

const BASE = import.meta.env.BASE_URL;

export const HITSOUND = {
	NORMAL: 'default/normal-hitnormal',
} as const;

const DEFAULT_SAMPLES: Record<string, string> = {
	[HITSOUND.NORMAL]: `${BASE}skins/default/hitsounds/normal-hitnormal.wav`,
};

/** Decode the default skin's hitsounds so they can be played with no latency. */
export function preloadDefaultHitsounds(): Promise<void> {
	return effects.preload(DEFAULT_SAMPLES);
}

/** Play the hitsound(s) for a landed hit, now. (For now: always the default normal.) */
export function playHitsound(): void {
	effects.play(HITSOUND.NORMAL);
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
