import { useEffect, useRef } from 'react';
import { music } from '../audio/MusicPlayer';
import { logoPulse } from './logoPulse';

interface Props {
	/** diameter of the logo this wraps, in px */
	size: number
	/**
	 * Where the bars start, as a fraction of the logo's half-size (size/2):
	 * 1 = the canvas edge, 0 = the centre. Bump this until the bar roots sit
	 * exactly on the visible logo rim. Tracks the logo's live pulse automatically.
	 */
	baseRadius?: number
	/** max bar length, as a fraction of the logo's half-size (size/2) */
	maxLength?: number
}

// osu!'s logo visualiser draws the spectrum several times around the circle
// ("rounds"), each round rotated, giving a symmetric bloom of white bars.
const ROUNDS = 5;
const BARS_PER_ROUND = 32;
const TOTAL = ROUNDS * BARS_PER_ROUND;
// how many (low) frequency bins feed one round - bass/mids carry the motion
const BINS_USED = 24;

// The same bars are drawn three times, only the style differs: a solid headline pass,
// a softer half-opacity ghost, and an outline-only (no fill) envelope. Their slightly
// different heights make them overlap into a layered bloom.
const LAYERS = [
	{ mode: 'fill', width: 6, height: 0.35, baseAlpha: 0.4, gainAlpha: 0.55, opacity: 1 },
	{ mode: 'fill', width: 6, height: 0.45, baseAlpha: 0.4, gainAlpha: 0.55, opacity: 0.5 },
	{ mode: 'stroke', width: 8, height: 0.7, baseAlpha: 0.45, gainAlpha: 0.45, opacity: 0.9 },
] as const;

// Every bar continuously follows the song (its "normal" height = the live spectrum).
// On top of that sit the waves: each is a position rolling around the ring doing nothing -
// until it fires, when the few bars it is currently over get multiplied up by a random
// amount (sometimes very high, sometimes medium) and then fall back on their own.
const SPECTRUM_GAIN = 1.25;// scales raw spectrum into the bar's normal height
const NORMAL_RELEASE = 0.15;// normal-height fall per second (attack is instant)
const RING_BASE = 0.12;// faint always-present ring (in maxLen units)

const WAVE_SPEED = 20;// base roll speed (round-positions/sec); each wave scales off this
const WAVE_WIDTH = 2;// bars either side of a wave the spike reaches
const WAVE_MIN = 1.5;// smallest spike multiplier boost ("medium high")
const WAVE_MAX = 6;// largest spike multiplier boost ("very high")
const WAVE_DECAY = 0.03;// spike fall per second after firing (drops on its own)

// The independent waves circling the logo. `spikes` is how many evenly-spaced spikes the
// wave carries per round (so ×ROUNDS around the full ring), `dir` the spin direction,
// `speed` the roll rate (round-positions/sec), `strength` scales the spike height, `perBeat`
// is how often it fires (1 = on the beat, 2 = every 1/2 beat, 4 = every 1/4 beat). Each
// successive wave spins twice as fast, half as strong, firing twice as often. Add/remove
// entries to change how many waves there are.
const WAVES = [
	{ spikes: 1, speed: WAVE_SPEED, dir: -1, strength: 1, perBeat: 1 },
	{ spikes: 2, speed: WAVE_SPEED * 2, dir: -1, strength: 0.25, perBeat: 2 },
	{ spikes: 4, speed: WAVE_SPEED * 4, dir: -1, strength: 0.125, perBeat: 4 },
] as const;

/**
 * The white waveform that haloes the osu! logo and dances to the music. Drawn on a
 * canvas: bars continuously track the spectrum, and several waves roll around the ring
 * (alternating directions) spiking the handful of bars under each as it fires on the
 * beat before they fall back. Stroked as radial bars in three overlapping layers.
 */
export default function LogoVisualizer({ size, baseRadius = 0.87, maxLength = 0.4 }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// everything is keyed by position *within a round* (the 5 rounds are identical rotated
	// copies -> 5-fold symmetric, so a wave's spikes repeat in every round and fill the ring).
	const normalHeight = useRef(new Array(BARS_PER_ROUND).fill(0));// live song-following height
	const waveBoost = useRef(new Array(BARS_PER_ROUND).fill(0));// transient spike multiplier
	const phases = useRef(WAVES.map(() => 0));// each wave's rolling position, in round-positions

	useEffect(() => {
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		// canvas is larger than the logo so bars have room to extend
		const dim = size * 2;
		canvas.width = dim * dpr;
		canvas.height = dim * dpr;
		canvas.style.width = `${dim}px`;
		canvas.style.height = `${dim}px`;
		ctx.scale(dpr, dpr);

		const cx = dim / 2;
		const cy = dim / 2;
		const half = size / 2;// the logo's half-size; base/length are fractions of it
		const maxLen = half * maxLength;

		// fire wave w: spike the bars under each of its evenly-spaced spikes (within a round,
		// so they repeat in every round) by a random multiplier scaled by its strength, each
		// spike with its own roll; they fall back on their own afterwards.
		const reach = Math.ceil(WAVE_WIDTH);
		const spike = (w: number) => {
			const wave = WAVES[w];
			const boost = waveBoost.current;
			const gap = BARS_PER_ROUND / wave.spikes;
			for (let s = 0; s < wave.spikes; s++) {
				const mag = (WAVE_MIN + Math.random() * (WAVE_MAX - WAVE_MIN)) * wave.strength;
				const centre = phases.current[w] + s * gap;// where this spike sits in the round
				const c0 = Math.round(centre);
				for (let o = -reach; o <= reach; o++) {
					const d = Math.abs(c0 + o - centre);// distance in bars to the spike centre
					if (d > WAVE_WIDTH) continue;
					const idx = (((c0 + o) % BARS_PER_ROUND) + BARS_PER_ROUND) % BARS_PER_ROUND;
					boost[idx] = Math.max(boost[idx], mag * (1 - d / WAVE_WIDTH));
				}
			}
		};

		// on each beat fire every wave, plus extra sub-beat fires for the faster ones,
		// spaced across the beat using the measured beat interval (tempo ~constant)
		let lastBeat = 0;
		const timeouts = new Set<ReturnType<typeof setTimeout>>();
		const offBeat = music.listeners.beat.on(() => {
			const now = performance.now();
			const interval = lastBeat ? now - lastBeat : 0;
			lastBeat = now;
			for (let w = 0; w < WAVES.length; w++) {
				spike(w);// the on-beat fire
				if (interval <= 0) continue;
				for (let k = 1; k < WAVES[w].perBeat; k++) {
					const id = setTimeout(() => { timeouts.delete(id); spike(w); }, (k / WAVES[w].perBeat) * interval);
					timeouts.add(id);
				}
			}
		});

		let raf = 0;
		let last = performance.now();
		const draw = (t: number) => {
			const dt = Math.min(0.05, (t - last) / 1000);// clamp big gaps (tab was hidden)
			last = t;
			ctx.clearRect(0, 0, dim, dim);
			const spectrum = music.getSpectrum();
			// follow the logo's live breathing/beat scale, sitting just past the rim
			const base = half * baseRadius * logoPulse.scale;

			// roll each wave position; decay the beat-spikes; follow the spectrum (instant up)
			for (let w = 0; w < WAVES.length; w++) {
				let p = (phases.current[w] + WAVES[w].speed * WAVES[w].dir * dt) % BARS_PER_ROUND;
				if (p < 0) p += BARS_PER_ROUND;// keep positive after a backwards (dir -1) step
				phases.current[w] = p;
			}
			const normal = normalHeight.current;
			const boost = waveBoost.current;
			const release = Math.pow(NORMAL_RELEASE, dt);
			const spikeDecay = Math.pow(WAVE_DECAY, dt);
			for (let i = 0; i < BARS_PER_ROUND; i++) {
				const bin = Math.floor(i / BARS_PER_ROUND * BINS_USED);
				const target = spectrum ? Math.min(1, (spectrum[bin] ?? 0) * SPECTRUM_GAIN) : 0;
				normal[i] = target > normal[i] ? target : normal[i] * release;
				boost[i] *= spikeDecay;
			}

			for (let L = 0; L < LAYERS.length; L++) {
				const cfg = LAYERS[L];
				for (let b = 0; b < TOTAL; b++) {
					const i = b % BARS_PER_ROUND;
					// the spike is a multiplier on the bar's normal song-following height
					const amp = RING_BASE + normal[i] * (1 + boost[i]);
					if (amp < 0.01) continue;
					const angle = (b / TOTAL) * Math.PI * 2 - Math.PI / 2;
					const len = amp * maxLen * cfg.height;
					const alpha = (cfg.baseAlpha + Math.min(1, amp) * cfg.gainAlpha) * cfg.opacity;

					// draw the bar as a capsule in its own rotated frame, extending
					// outward from `base`; fill it solid or stroke just its outline
					ctx.save();
					ctx.translate(cx, cy);
					ctx.rotate(angle);
					ctx.beginPath();
					ctx.roundRect(base, -cfg.width / 2, len, cfg.width, cfg.width / 2);
					if (cfg.mode === 'stroke') {
						ctx.lineWidth = 1.5;
						ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
						ctx.stroke();
					} else {
						ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
						ctx.fill();
					}
					ctx.restore();
				}
			}

			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => {
			cancelAnimationFrame(raf);
			offBeat();
			timeouts.forEach(clearTimeout);
		};
	}, [size, baseRadius, maxLength]);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: 'absolute',
				top: '50%',
				left: '50%',
				transform: 'translate(-50%, -50%)',
				pointerEvents: 'none',
				zIndex: 0,
			}}
		/>
	);
}
