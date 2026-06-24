import { Beatmap } from 'osu-classes';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { audioContext } from './audioContext';
import { effects } from './EffectPlayer';
import { SampleSchedule } from './SampleSchedule';
import { preloadSamples } from './hitsounds';
import { loadStoryboardAssets } from '../osu/beatmap/storyboard';
import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import Synced from '@osu-idle/shared/helpers/synced';
import Listener from '@osu-idle/shared/helpers/listener';
import { SETTINGS } from '../db/settings';

export const PLAYER_MODE = mapped(['PLAYLIST', 'LOOP', 'SINGLE']);
export type PlayerMode = ValueIn<typeof PLAYER_MODE>;

/** how far ahead storyboard samples are queued onto the audio clock (ms). Must
 *  exceed the background timer-throttle floor so a hidden tab still queues. */
const SAMPLE_LOOKAHEAD_MS = 1200;
const SAMPLE_TICK_MS = 120;
/** silence kept after the last sound before a track is considered finished. */
const END_PAD_MS = 800;

export class MusicPlayer {

	public listeners = { beat: new Listener<(beat: number, time: number) => void>() };

	public readonly beatmap = new Synced<LightBeatmap | undefined>(undefined);
	public readonly playing = new Synced(false);
	public readonly mode = new Synced<PlayerMode>(PLAYER_MODE.PLAYLIST);
	
	private _playing = false;
	private raf = new Listener<() => void>();

	private readonly audioSource = new Synced<string | undefined>(undefined);

	private _audio?: HTMLAudioElement;
	private get audio(): HTMLAudioElement {
		if (!this._audio) {
			this._audio = new Audio();
			this._audio.preload = 'auto';
			// preview clips stream from the API origin; without CORS the element feeds
			// the (cross-origin) audio graph silence. Must be set before any src.
			this._audio.crossOrigin = 'anonymous';
			this._audio.volume = 1; // real volume is handled by the gain node
		}
		return this._audio;
	}
	
	constructor() {
		this.context = this.getAudioContext();

		this.beatmap.sync(async beatmap => {
			await this.audioSource.set(await this.getAudioSource(beatmap));
			void this.loadTimeline(beatmap);
		});

		this.audioSource.sync(async src => {
			delete this.lastBeat;

			if (!src) {
				// no backing track (virtual map): clear the element so syncAudio won't
				// replay the previous map's audio. The samples drive playback instead.
				this.audio.pause();
				this.audio.removeAttribute('src');
				this.audio.load();
				return;
			}

			this.audio.src = src;
		});

		Synced.all([
			SETTINGS.mainVolume,
			SETTINGS.musicVolume,
		], ([main, music]) => {
			if (!this._gain) return;
			this._gain.gain.setTargetAtTime(music * main, this.context.currentTime, 0.05);
		});

		this.initBeatDetection();
		this.initRaf();
		this.initSampleScheduler();
	}

	// ---- virtual timeline (menus / preview) ----
	// The song position is a virtual clock spanning the whole beatmap, not just
	// the audio file: it runs through blanks before/after the audio and works for
	// no-audio ("virtual") maps whose sound is entirely storyboard samples. The
	// <audio> element is a slave - started when the position enters its range,
	// left to end on its own - while the position keeps advancing on the shared
	// AudioContext clock. Storyboard samples are scheduled on the effects channel.
	private anchorPos = 0; // song position (ms) at anchorCtx
	private anchorCtx = 0; // AudioContext time (s) the anchor was taken
	private pausePos?: number; // frozen position while paused
	private advancing = false; // guards against re-firing next/loop at the end
	private sampleStart = 0;
	private sampleEnd = 0;
	private samples?: SampleSchedule;

	private songStart(): number {
		return Math.min(0, this.sampleStart);
	}

	/** Decode the map's storyboard samples, preload them, and record the timeline
	 *  bounds. Runtime (downloaded) maps only - others have no bundled samples. */
	private async loadTimeline(map: LightBeatmap | undefined): Promise<void> {
		this.samples = undefined;
		this.sampleStart = 0;
		this.sampleEnd = 0;
		if (!map || !map.metadata.runtime) return;
		try {
			const beatmap = await map.load();
			if (!this.beatmap.get()?.is(map)) return; // a newer track was selected
			const assets = await loadStoryboardAssets(map, beatmap);
			if (!this.beatmap.get()?.is(map)) return;
			// a virtual (no-audio) map's song is its keysounds + storyboard samples, so
			// play both in the menu. A normal map's keysounds are gameplay-only.
			const menu = this.audioSource.get()
				? assets.samples
				: [...assets.samples, ...assets.keysounds].sort((a, b) => a.time - b.time);
			this.samples = new SampleSchedule(menu);
			this.sampleStart = menu.length ? menu[0].time : 0;
			this.sampleEnd = menu.reduce((m, s) => Math.max(m, s.time), 0);
			await preloadSamples(map.set.metadata.id, menu);
		} catch (e) {
			console.warn('[music] storyboard load failed', e);
		}
	}

	/** Start, seek or stop the slave <audio> element to track the virtual position.
	 *  Once the track ends it stays ended (the clock continues past it). */
	private syncAudio(pos: number): void {
		if (!this.audio.src) return; // no backing track (virtual map)
		if (pos < 0) {
			if (!this.audio.paused) this.audio.pause();
			return;
		}
		if (this.audio.paused && !this.audio.ended) {
			if (Math.abs(this.audio.currentTime * 1000 - pos) > 250) 
				this.audio.currentTime = pos / 1000;
			void this.audio.play().catch(() => {});
		}
	}

	/**
	 * Whether the virtual position has passed the end of every sound (audio +
	 * samples). While the audio is still loading or playing the song never ends.
	 */
	private atEnd(pos: number): boolean {
		const hasAudio = !!this.audio.src;
		const audioMs = isFinite(this.audio.duration) ?
			this.audio.duration * 1000 
			: undefined;
		if (hasAudio && (audioMs === undefined || (!this.audio.ended && pos < audioMs)))
			return false;
		return pos >= Math.max(audioMs ?? 0, this.sampleEnd) + END_PAD_MS;
	}

	/** Drive the slave audio, queue storyboard samples, and advance at the end.
	 *  A timer (not rAF) so it keeps running while the tab is hidden. Idle during
	 *  gameplay, which owns its own buffer clock (see playGameplay / gameTime). */
	private initSampleScheduler(): void {
		setInterval(() => {
			if (this.gameStartCtx != null) return; // gameplay buffer owns the clock
			if (!this._playing) return;
			if (!this.beatmap.get()) return;
			const pos = this.time();
			this.syncAudio(pos);
			this.samples?.queue(pos, SAMPLE_LOOKAHEAD_MS);
			if (this.atEnd(pos) && !this.advancing) {
				this.advancing = true;
				this.handleEnded();
			}
		}, SAMPLE_TICK_MS);
	}

	private _gain?: GainNode;
	private _analyser?: AnalyserNode;
	private _source?: MediaElementAudioSourceNode;
	private _freqData?: Uint8Array<ArrayBuffer>;
	private context: AudioContext;
	private getAudioContext() {
		const ctx = audioContext;
		this._source = ctx.createMediaElementSource(this.audio);
		this._gain = ctx.createGain();
		this._gain.gain.value = SETTINGS.musicVolume.get() * SETTINGS.mainVolume.get();
		this._analyser = ctx.createAnalyser();
		this._analyser.fftSize = 256;
		this._analyser.smoothingTimeConstant = 0.78;
		this._freqData = new Uint8Array(this._analyser.frequencyBinCount);
		this._source.connect(this._analyser);
		this._analyser.connect(this._gain);
		this._gain.connect(ctx.destination);

		return ctx;
	}
	
	private async getAudioSource(
		map: LightBeatmap | undefined,
	): Promise<string | undefined> {
		if (!map) return;
		return BeatmapStore.getBeatmapAudio(map);
	}

	private handleEnded(): void {
		switch (this.mode.get()) {
			case PLAYER_MODE.LOOP:
				this.play(0);
				break;
			case PLAYER_MODE.PLAYLIST:
				this.next();
				break;
		}
	};

	private lastBeat?: number;
	private currentBeatmapId = -1;
	private currentBeatmap?: Beatmap;
	private initBeatDetection() {
		this.raf.on(() => {
			const beatmap = this.beatmap.get();

			if (!beatmap || !beatmap.metadata.runtime) {
				this.currentBeatmapId = -1;
				delete this.currentBeatmap;
				return;
			}
			if (!beatmap.is(this.currentBeatmapId)) {
				this.currentBeatmapId = beatmap.metadata.id;
				delete this.currentBeatmap;
				beatmap.load().then(beatmap => this.currentBeatmap = beatmap);
			}
			if (!this.currentBeatmap) return;

			const ms = this.time();
			const timingPoint = this.currentBeatmap.controlPoints.timingPointAt(ms);
			if (!timingPoint) return;

			const beat = Math.floor((ms - timingPoint.startTime) / timingPoint.beatLength);

			// before the first timing point (the "drop") - no beats yet
			if (beat < 0) return; 
			if (this.lastBeat === beat) return;

			this.lastBeat = beat;
			this.listeners.beat.trigger(beat, ms);
		});
	}

	/** Fully buffer the current streaming track and pre-seek it to `atMs` so a
	 *  later play() at that position starts instantly instead of stalling on a
	 *  cold load/seek. Best-effort: resolves as soon as the position is playable.
	 *  (The src is set by the beatmap/audioSource sync, so call after awaiting
	 *  `beatmap.set`.) */
	async preload(atMs = 0): Promise<void> {
		const audio = this.audio;
		if (!audio.src) return;
		const ready = (state: number, event: string) => audio.readyState >= state
			? Promise.resolve()
			: new Promise<void>(resolve => audio.addEventListener(event, 
				() => resolve(), 
				{ once: true },
			));
		await ready(1 /* HAVE_METADATA */, 'loadedmetadata');
		if (atMs > 0) audio.currentTime = atMs / 1000;
		await ready(3 /* HAVE_FUTURE_DATA */, 'canplay');
	}

	async play(atMs?: number) {
		if (this.gameRiding) this.stopRiding();
		if (this.context.state === 'suspended') await this.context.resume();
		const pos = atMs ?? this.pausePos ?? this.songStart();
		this.anchorPos = pos;
		this.anchorCtx = this.context.currentTime;
		this.pausePos = undefined;
		this.advancing = false;
		this._playing = true;
		this.samples?.resync(pos);
		effects.stopAll();
		this.syncAudio(pos);
		await this.playing.set(true);
	}

	pause() {
		if (this.gameRiding) this.stopRiding();
		this.pausePos = this.time();
		this._playing = false;
		this.audio.pause();
		effects.stopAll();
		this.playing.set(false);
	}

	stop() {
		if (this.gameRiding) this.stopRiding();
		this._playing = false;
		this.audio.pause();
		this.audio.currentTime = 0;
		this.pausePos = this.songStart();
		effects.stopAll();
		this.playing.set(false);
	}

	async next() {
		const all = (await BeatmapStore.getAllSets()).flatMap(set => set.beatmaps);
		if (!all.length) return;
		await music.beatmap.set(all[Math.floor(Math.random() * all.length)]);
		await music.play(0);
	}

	time() {
		// during gameplay the buffer clock is authoritative
		if (this.gameStartCtx != null) return this.gameTime();
		if (!this._playing) return this.pausePos ?? this.songStart();
		// while the slave audio is actively playing, trust it and re-anchor the
		// virtual clock to it - so the audio region is drift-free and the blanks
		// before/after it continue smoothly from the same position.
		if (
			this.audio.src 
			&& !this.audio.paused 
			&& !this.audio.ended 
			&& this.audio.currentTime > 0
		) {
			this.anchorPos = this.audio.currentTime * 1000;
			this.anchorCtx = this.context.currentTime;
			return this.anchorPos;
		}
		return this.anchorPos + (this.context.currentTime - this.anchorCtx) * 1000;
	}

	/** true once the underlying audio element has played past its end */
	ended(): boolean {
		return !!this._audio?.ended;
	}

	seek(ms: number) {
		this.anchorPos = ms;
		this.anchorCtx = this.context.currentTime;
		if (!this._playing) this.pausePos = ms;
		this.samples?.resync(ms);
		effects.stopAll();
		if (!this.audio.src) return;
		if (ms < 0) {
			if (!this.audio.paused) this.audio.pause();
		} else {
			this.audio.currentTime = ms / 1000;
		}
	}

	// ---- gameplay buffer playback ----
	// Gameplay needs music and hitsounds on one sample-accurate clock, so the
	// track is decoded to an AudioBuffer and played through the SAME AudioContext
	// as the hitsounds (see audioContext.ts) - but still through the music gain
	// node, so it keeps the music volume, not the effects volume. The streaming
	// <audio> element above is left untouched and still drives menu / preview.
	private gameBuffer?: AudioBuffer;
	private gameSource?: AudioBufferSourceNode;
	/** context time (s) that maps to song position 0; undefined = not started */
	private gameStartCtx?: number;
	/** true while a finished play's track is allowed to keep playing to its
	 *  natural end (see endGameplay) instead of being cut at the result screen */
	private gameRiding = false;

	/**
	 * Decode the gameplay track up front (during the silent lead-in) so it can be
	 * started sample-accurately. Resolves to false for keysound maps (no track).
	 */
	async prepareGameplay(map: LightBeatmap): Promise<boolean> {
		this.stopGameplay();
		const url = await this.getAudioSource(map);
		if (!url) return false;
		const bytes = await (await fetch(url)).arrayBuffer();
		this.gameBuffer = await this.context.decodeAudioData(bytes);
		return true;
	}

	/** Start the prepared track so song position `atMs` is heard now. Restarting
	 *  (e.g. an intro skip) is fine - it just re-anchors. `atMs` beyond the track
	 *  length plays no sound but still anchors the clock so the play can resolve. */
	playGameplay(atMs = 0): void {
		if (!this.gameBuffer) return;
		if (this.context.state === 'suspended') void this.context.resume();
		this.disposeGameSource();

		const offset = Math.max(0, atMs / 1000);
		const when = this.context.currentTime;
		this.gameStartCtx = when - offset;
		this._playing = true;
		this.playing.set(true);

		if (offset >= this.gameBuffer.duration) return; // past the end: clock only
		const src = this.context.createBufferSource();
		src.buffer = this.gameBuffer;

		// → music gain → destination (volume + visualiser)
		src.connect(this._analyser!);
		src.start(when, offset);
		this.gameSource = src;
	}

	/** Silence the playing gameplay track but keep the decoded buffer so it can be
	 * restarted from a given position (debug pause / seek) Resume with playGameplay
	 */
	pauseGameplay(): void {
		this.disposeGameSource();
	}

	/** Gameplay song position (ms) from the shared audio clock. Advances smoothly
	 *  forever - even past the track end - so the final notes always resolve. */
	gameTime(): number {
		return this.gameStartCtx == null ? 0 
			: (this.context.currentTime - this.gameStartCtx) * 1000;
	}

	/** End the play but let the decoded track keep playing to its natural end -
	 *  no cut, no restart - so the result screen hears it continue seamlessly.
	 *  When the buffer reaches its end (or a new song is requested, see play /
	 *  stopRiding) playback hands back to the streaming element. */
	endGameplay(): void {
		// The track is usually shorter than the map (silent outro after the last
		// note), so by the time the play ends the buffer has often already finished
		// - its onended has fired and won't fire again. Only ride it out while it's
		// genuinely still playing; otherwise (or for keysound maps with no source)
		// behave as before: release and hand straight back to the streamer.
		const stillPlaying = this.gameSource 
			&& this.gameBuffer
			&& this.gameStartCtx != null
			&& this.gameTime() < this.gameBuffer.duration * 1000;
		if (!stillPlaying) {
			this.stopGameplay();
			this.pause();
			return;
		}
		this.gameRiding = true;
		if (this.gameSource) this.gameSource.onended = () => {
			// ignore if this source was already torn down for a new play/song
			if (!this.gameRiding) return;
			this.stopRiding();
			this.pause();
		};
	}

	/** Tear down the gameplay buffer source and release the decoded track. */
	stopGameplay(): void {
		this.gameRiding = false;
		this.disposeGameSource();
		this.gameBuffer = undefined;
		this.gameStartCtx = undefined;
		this._playing = false;
		this.playing.set(false);
	}

	/** Drop a riding-out gameplay track without touching the playing flags - used
	 *  when streaming takes over, so there's no transient pause/flicker. */
	private stopRiding(): void {
		this.gameRiding = false;
		this.disposeGameSource();
		this.gameBuffer = undefined;
		this.gameStartCtx = undefined;
	}

	private disposeGameSource(): void {
		if (!this.gameSource) return;
		// we're stopping it deliberately, don't hand back
		this.gameSource.onended = null;
		try { this.gameSource.stop(); } catch { /* already stopped/ended */ }
		this.gameSource.disconnect();
		this.gameSource = undefined;
	}
	
	/** Normalised (0..1) frequency magnitudes for the visualiser, or null. */
	getSpectrum(): number[] | null {
		if (!this._analyser || !this._freqData) return null;
		this._analyser.getByteFrequencyData(this._freqData);
		return Array.from(this._freqData, (v) => v / 255);
	}

	changeGain(target: number, ms: number, from?: number): void {
		if (!this._gain || !this.context) return;
		const now = this.context.currentTime;
		const g = this._gain?.gain;
		g.cancelScheduledValues(now);
		g.setValueAtTime(from ?? g.value, now);
		g.linearRampToValueAtTime(target, now + Math.max(0.001, ms / 1000));
	}

	fadeOut(ms = 320): void {
		this.changeGain(0, ms);
	}

	/** Ramp from silence up to the current music volume - used to soften an abrupt
	 *  start when playback begins mid-song (e.g. the random startup track). */
	fadeIn(ms = 800): void {
		const target = SETTINGS.musicVolume.get() * SETTINGS.mainVolume.get();
		this.changeGain(target, ms, 0);
	}

	private initRaf() {
		const tick = async () => {
			await this.raf.trigger();
			requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}

	restart() {
		this.pause();
		this.play(0);
	}
	
	toggle() {
		if (this._playing) this.pause(); else this.play();
	}
}

// HMR Reuse instance
const globalStore = globalThis as unknown as { __osuIdleMusic?: MusicPlayer };
 
export const music: MusicPlayer = globalStore.__osuIdleMusic ?? new MusicPlayer();
globalStore.__osuIdleMusic = music;