import Log from '@osu-idle/shared/helpers/log';
import { audioContext } from './audioContext';
import { SETTINGS } from '../db/settings';
import Synced from '@osu-idle/shared/helpers/synced';

export type PlayOptions = {
	/** start this many ms from now (default 0 = as soon as possible) */
	delayMs?: number;
	/** absolute AudioContext time (ms) to start at - overrides delayMs. Use with
	 *  `EffectPlayer.now()` to schedule a sample to the millisecond. */
	atMs?: number;
	/** per-shot volume multiplier on top of the master volume (default 1) */
	volume?: number;
	/** playback rate / pitch (default 1) */
	rate?: number;
};

/**
 * Fire-and-forget sample player for short sound effects (hitsounds, UI blips).
 *
 * Unlike {@link MusicPlayer} - which streams a single track through an <audio>
 * element - this decodes samples into AudioBuffers up front so any number of
 * them can be triggered with no load latency and scheduled against the audio
 * clock to the millisecond. Each shot spins up a throwaway buffer source; there
 * is no notion of "the current sound", so overlapping triggers just stack.
 *
 * Samples are addressed by an opaque string key. Callers (e.g. the hitsound
 * layer) own what those keys mean; this class only loads and plays them.
 */
export class EffectPlayer {

	private readonly context: AudioContext;
	private readonly master: GainNode;

	private readonly buffers = new Map<string, AudioBuffer>();
	private readonly loading = new Map<string, Promise<AudioBuffer | undefined>>();
	/** live shots (scheduled or playing) so they can be silenced en masse - e.g.
	 *  to cancel look-ahead hitsounds when a play ends abruptly on fail. */
	private readonly active = new Set<AudioBufferSourceNode>();

	constructor() {
		this.context = audioContext;
		this.master = this.context.createGain();
		this.master.gain.value = 
			SETTINGS.effectVolume.get() * SETTINGS.mainVolume.get();
		this.master.connect(this.context.destination);

		Synced.all([
			SETTINGS.mainVolume,
			SETTINGS.effectVolume,
		], ([main, effect]) => {
			const level = Math.max(0, Math.min(1, effect)) *  main;
			this.master.gain.setTargetAtTime(level, this.context.currentTime, 0.02);
		});
	}

	/** Current audio-clock time in ms - pair with {@link play}'s `atMs`. */
	public now(): number {
		return this.context.currentTime * 1000;
	}

	public isLoaded(key: string): boolean {
		return this.buffers.has(key);
	}

	/**
	 * Decode and cache a sample under `key`. Idempotent and de-duplicated: calling
	 * it again with an already-loaded (or in-flight) key reuses the existing work.
	 */
	public load(key: string, url: string): Promise<AudioBuffer | undefined> {
		const cached = this.buffers.get(key);
		if (cached) return Promise.resolve(cached);

		const inFlight = this.loading.get(key);
		if (inFlight) return inFlight;

		const promise = (async () => {
			try {
				const res = await fetch(url);
				const bytes = await res.arrayBuffer();
				const buffer = await this.context.decodeAudioData(bytes);
				this.buffers.set(key, buffer);
				return buffer;
			} catch (e) {
				Log.errorPopup(`Failed to load sample "${key}": ${String(e)}`);
				return undefined;
			} finally {
				this.loading.delete(key);
			}
		})();

		this.loading.set(key, promise);
		return promise;
	}

	/** Decode and cache a batch of samples keyed by name. */
	public async preload(samples: Record<string, string>): Promise<void> {
		await Promise.all(
			Object.entries(samples)
				.map(([key, url]) => this.load(key, url)),
		);
	}

	/**
	 * Trigger a preloaded sample. No-op (with a warning) if the key isn't loaded -
	 * effects are fire-and-forget, so a missing sample should never stall the
	 * caller. Returns nothing; once started the shot cleans itself up.
	 */
	public play(key: string, options: PlayOptions = {}): void {
		const buffer = this.buffers.get(key);
		if (!buffer) {
			console.warn(`[effects] sample "${key}" not loaded; dropping`);
			return;
		}

		// browsers suspend the context until a user gesture; resume lazily
		if (this.context.state === 'suspended') void this.context.resume();

		const source = this.context.createBufferSource();
		source.buffer = buffer;
		source.playbackRate.value = options.rate ?? 1;

		let out: AudioNode = this.master;
		let gain: GainNode | undefined;
		if (options.volume != null && options.volume !== 1) {
			gain = this.context.createGain();
			gain.gain.value = Math.max(0, options.volume);
			gain.connect(this.master);
			out = gain;
		}
		source.connect(out);

		this.active.add(source);
		source.onended = () => {
			this.active.delete(source);
			source.disconnect();
			gain?.disconnect();
		};

		const when = options.atMs != null
			? options.atMs / 1000
			: this.context.currentTime + Math.max(0, options.delayMs ?? 0) / 1000;
		source.start(Math.max(when, this.context.currentTime));
	}

	/**
	 * Immediately silence every shot currently scheduled or playing. Used to drop
	 * look-ahead-queued effects (e.g. hitsounds) when a play ends early on fail, so
	 * they don't keep firing after gameplay has stopped.
	 */
	public stopAll(): void {
		for (const source of this.active) {
			try { source.stop(); } catch { /* already stopped or ended */ }
		}
		this.active.clear();
	}
}

// HMR reuse instance (mirrors MusicPlayer) so hot reloads don't leak contexts
 
const globalStore = globalThis as unknown as { __osuIdleEffects?: EffectPlayer };
 
export const effects: EffectPlayer = globalStore.__osuIdleEffects ?? new EffectPlayer();
globalStore.__osuIdleEffects = effects;
