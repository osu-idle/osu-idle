import type {
	HitObject,
	IHasColumn,
	IHoldableObject,
} from 'osu-classes';

export default class RuntimeNote {

	constructor(
		public time: number,
		public endTime: number,
		public column: number,
		public hold: boolean,
		public headJudged: boolean,
		public tailJudged: boolean,
		public holding: boolean,
		/** beat-snap divisor (1 = on-beat, 4 = 1/4, …; 0 = unsnapped) */
		public snap: number = 0,
		/** custom sample filenames carried from the beatmap (keysounds), if any.
		 *  Resolved to actual sounds by the client; the sim never reads them. */
		public samples: string[] = [],
	) {}

	/** song time (ms) at which the tail resolved as a MISS (a dropped/fumbled
	 *  hold) - lets the renderer keep the remaining body on screen, dimmed,
	 *  instead of vanishing it the instant the tail is judged */
	public tailMissedAt?: number;

	/** signed press error (ms) recorded when this hold's head was caught;
	 *  `undefined` until then (and on a missed head). Combined with the release
	 *  error at the tail to form the long note's single judgement. */
	public headOffset?: number;

	getEndTime(): number {
		return this.hold ? this.endTime : this.time;
	}

	getId(): string {
		return `${this.column}-${this.time}`;
	}

	public static fromHitObject(
		hitObject: HitObject | IHoldableObject | IHasColumn,
		snap: number,
	): RuntimeNote {
		const samples = 'samples' in hitObject
			? hitObject.samples.map(s => s.filename).filter((f): f is string => !!f)
			: [];
		return new RuntimeNote(
			'startTime' in hitObject ? hitObject.startTime : 0,
			'endTime' in hitObject ? hitObject.endTime : 0,
			'column' in hitObject ? hitObject.column : 0,
			'endTime' in hitObject,
			false,
			false,
			false,
			snap,
			samples,
		);
	}

}
