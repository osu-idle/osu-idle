import type { TimingPoint } from 'osu-classes';

/** beat-snap divisors osu! recognises, coarsest grid first */
const SNAP_DIVISORS = [1, 2, 3, 4, 6, 8, 12, 16];
/** how far (ms) a note may sit off a gridline and still count as snapped to it */
const SNAP_TOLERANCE_MS = 3;

function gcd(a: number, b: number): number {
	while (b) [a, b] = [b, a % b];
	return a || 1;
}

/**
 * Classify a note's beat-snap: the divisor of the beat subdivision it lands on
 * (1 = on the beat, 2 = 1/2, 4 = 1/4, 3 = 1/3, …). Returns 0 when the note
 * doesn't align to any recognised division ("unsnapped"). Works off the active
 * (most recent) uninherited timing point at `time`.
 */
const beatSnap = (time: number, timingPoints: TimingPoint[]): number => {
	let tp: TimingPoint | undefined;
	for (const p of timingPoints) {
		if (p.startTime <= time) tp = p;
		else break;
	}
	tp ??= timingPoints[0];
	if (!tp || tp.beatLength <= 0) return 0;

	// fractional position within the beat, in [0, 1)
	const beats = (time - tp.startTime) / tp.beatLength;
	let frac = beats - Math.floor(beats);
	if (frac < 0) frac += 1;

	for (const d of SNAP_DIVISORS) {
		const k = Math.round(frac * d);
		if (Math.abs(frac - k / d) * tp.beatLength <= SNAP_TOLERANCE_MS) {
			// reduce k/d to lowest terms so e.g. 2/4 reports as 1/2, on-beat as 1/1
			return d / gcd(((k % d) + d) % d, d);
		}
	}
	return 0;
};

export default beatSnap;
