export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: Easing = (t) =>
	t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export type SmoothNumberOptions = {
	/** ms taken to travel a full transition, regardless of distance */
	duration?: number;
	/** easing applied across the transition (default easeOutCubic) */
	easing?: Easing;
	/** clock source in ms - injectable for tests (default performance.now) */
	now?: () => number;
};

/**
 * A number that eases toward a target instead of snapping to it.
 *
 * Pull-based: there's no internal timer or rAF, so it can't leak - `value` is
 * derived from the clock on read. Drive it from whatever loop you already have
 * (a canvas rAF, React, a one-off read) and just read `value`. Retargeting with
 * {@link set} always continues from wherever the value currently sits, so a new
 * target mid-flight glides smoothly rather than jumping.
 *
 *   const n = new SmoothNumber(100);
 *   n.set(150);   // glides 100 → 150 over `duration`
 *   n.value;      // current position, any time
 */
export class SmoothNumber {

	private from: number;
	private to: number;
	private startedAt: number;
	private duration: number;
	private readonly easing: Easing;
	private readonly now: () => number;

	constructor(initial: number, options: SmoothNumberOptions = {}) {
		this.from = initial;
		this.to = initial;
		this.duration = Math.max(0, options.duration ?? 300);
		this.easing = options.easing ?? easeOutCubic;
		this.now = options.now ?? (() => performance.now());
		this.startedAt = this.now();
	}

	/** The current, eased position between the last `from` and the target. */
	get value(): number {
		if (this.from === this.to || this.duration <= 0) return this.to;
		const t = (this.now() - this.startedAt) / this.duration;
		if (t <= 0) return this.from;
		if (t >= 1) return this.to;
		return this.from + (this.to - this.from) * this.easing(t);
	}

	/** The value being animated toward. */
	get target(): number {
		return this.to;
	}

	/** True once the value has settled on the target. */
	get done(): boolean {
		return this.from === this.to || this.now() - this.startedAt >= this.duration;
	}

	/**
	 * Animate toward `target`, optionally overriding the duration for this move.
	 * Re-setting the same target (with no new duration) is a no-op, so it's safe
	 * to call every frame from a reactive source without restarting the glide.
	 */
	set(target: number, duration?: number): void {
		if (target === this.to && duration === undefined) return;
		this.from = this.value; // continue from the current position
		this.to = target;
		this.startedAt = this.now();
		if (duration !== undefined) this.duration = Math.max(0, duration);
	}

	/** Snap to `value` immediately, cancelling any in-flight animation. */
	jump(value: number): void {
		this.from = value;
		this.to = value;
		this.startedAt = this.now();
	}
}
