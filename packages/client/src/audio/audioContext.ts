/**
 * The single, app-wide Web Audio context. Music and sound effects share it on
 * purpose: scheduling is only sample-accurate *relative to the same clock*, and
 * two contexts have independent clocks and independent output latencies. Sharing
 * one is what lets gameplay hitsounds stay locked to the music - most visibly on
 * iOS, where the per-context latency is large.
 */
const Ctx = window.AudioContext
	|| (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

// HMR reuse (mirrors MusicPlayer / EffectPlayer) so hot reloads don't leak contexts.
const globalStore = globalThis as unknown as { __osuIdleCtx?: AudioContext };
export const audioContext: AudioContext = globalStore.__osuIdleCtx ?? new Ctx();
globalStore.__osuIdleCtx = audioContext;
