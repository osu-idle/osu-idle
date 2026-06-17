import { GRADE, JUDGEMENT, type Grade, type Judgement } from '../judgement.js';

export const ACCURACY: {[key in Judgement]: number} = {
	[JUDGEMENT.MARVELOUS]: 1,
	[JUDGEMENT.PERFECT]: 1,
	[JUDGEMENT.GREAT]: 0.66,
	[JUDGEMENT.GOOD]: 0.33,
	[JUDGEMENT.BAD]: 0.16,
	[JUDGEMENT.MISS]: 0,
};

const HIT_VALUE: {[key in Judgement]: number} = {
	[JUDGEMENT.MARVELOUS]: 320,
	[JUDGEMENT.PERFECT]: 300,
	[JUDGEMENT.GREAT]: 200,
	[JUDGEMENT.GOOD]: 100,
	[JUDGEMENT.BAD]: 50,
	[JUDGEMENT.MISS]: 0,
};

const BONUS_VALUE: {[key in Judgement]: number} = {
	[JUDGEMENT.MARVELOUS]: 32,
	[JUDGEMENT.PERFECT]: 32,
	[JUDGEMENT.GREAT]: 16,
	[JUDGEMENT.GOOD]: 8,
	[JUDGEMENT.BAD]: 4,
	[JUDGEMENT.MISS]: 0,
};

const HIT_BONUS: {[key in Judgement]: number} = {
	[JUDGEMENT.MARVELOUS]: 2,
	[JUDGEMENT.PERFECT]: 1,
	[JUDGEMENT.GREAT]: -4,
	[JUDGEMENT.GOOD]: -24,
	[JUDGEMENT.BAD]: -44,
	[JUDGEMENT.MISS]: -Infinity,
};

const HP_VALUE: {[key in Judgement]: (od: number) => number} = {
	[JUDGEMENT.MARVELOUS]: (od) => 0.55 - od * 0.05,
	[JUDGEMENT.PERFECT]: (od) => 0.5 - od * 0.05,
	[JUDGEMENT.GREAT]:(od) => 0.4 - od * 0.04,
	[JUDGEMENT.GOOD]: () => 0,
	[JUDGEMENT.BAD]: (od) => -(od + 1) * 0.16,
	[JUDGEMENT.MISS]: (od) => -(od + 1) * 0.75,
};

export const MAX_HP = 100;

export type HitWindows = {[key in Judgement]: number};

export function maniaWindows(od: number): HitWindows {
	return {
		[JUDGEMENT.MARVELOUS]: 16.5,
		[JUDGEMENT.PERFECT]: 64 - 3 * od,
		[JUDGEMENT.GREAT]: 97 - 3 * od,
		[JUDGEMENT.GOOD]: 127 - 3 * od,
		[JUDGEMENT.BAD]: 151 - 3 * od,
		[JUDGEMENT.MISS]: 188 - 3 * od,
	};
}

export function judge(absOffsetMs: number, w: HitWindows): Judgement {
	if (absOffsetMs <= w[JUDGEMENT.MARVELOUS]) return JUDGEMENT.MARVELOUS;
	if (absOffsetMs <= w[JUDGEMENT.PERFECT]) return JUDGEMENT.PERFECT;
	if (absOffsetMs <= w[JUDGEMENT.GREAT]) return JUDGEMENT.GREAT;
	if (absOffsetMs <= w[JUDGEMENT.GOOD]) return JUDGEMENT.GOOD;
	if (absOffsetMs <= w[JUDGEMENT.BAD]) return JUDGEMENT.BAD;
	return JUDGEMENT.MISS;
}

/** One osu!mania hold-note tier: the maximum head error and maximum combined
 *  (head + tail) error a hold may have to earn `judgement`. */
export type HoldTier = { judgement: Judgement, head: number, combined: number };

export function holdTiers(w: HitWindows): HoldTier[] {
	return [
		{ judgement: JUDGEMENT.MARVELOUS, head: w[JUDGEMENT.MARVELOUS] * 1.2, combined: w[JUDGEMENT.MARVELOUS] * 2.4 },
		{ judgement: JUDGEMENT.PERFECT, head: w[JUDGEMENT.PERFECT] * 1.1, combined: w[JUDGEMENT.PERFECT] * 2.2 },
		{ judgement: JUDGEMENT.GREAT, head: w[JUDGEMENT.GREAT], combined: w[JUDGEMENT.GREAT] * 2 },
		{ judgement: JUDGEMENT.GOOD, head: w[JUDGEMENT.GOOD], combined: w[JUDGEMENT.GOOD] * 2 },
	];
}

export function judgeHold(headErr: number, tailErr: number, w: HitWindows): Judgement {
	const combined = headErr + tailErr;
	for (const tier of holdTiers(w)) {
		if (headErr <= tier.head && combined <= tier.combined) return tier.judgement;
	}
	return JUDGEMENT.BAD;
}

const MAX_SCORE = 1_000_000;

/** Running score / combo / accuracy state for a play. */
export class ScoreState {
	readonly counts: Record<Judgement, number> = {
		[JUDGEMENT.MARVELOUS]: 0,
		[JUDGEMENT.PERFECT]: 0,
		[JUDGEMENT.GREAT]: 0,
		[JUDGEMENT.GOOD]: 0,
		[JUDGEMENT.BAD]: 0,
		[JUDGEMENT.MISS]: 0,
	};
	combo = 0;
	maxCombo = 0;
	score = 0;
	/** current health (0..MAX_HP); drains on bad hits, restores on good ones */
	hp = MAX_HP;
	/** 1-based judgement index at which HP first hit 0, or -1 if never failed */
	failedIndex = -1;
	private accEarned = 0;
	private accPossible = 0;
	private bonus = 100;
	private judged = 0;

	/**
	 * @param maxObjects total number of judgements the play will have, used to
	 *   normalise the score to 1,000,000. When 0, the running judged count is
	 *   used (so the score reflects only what has been judged so far).
	 * @param noFail when set, HP draining to 0 never marks the play failed
	 *   (used by the local debug play).
	 */
	constructor(
		private readonly od: number,
		private readonly maxObjects = 0,
		private readonly noFail = false,
	) {}

	/** Wipe all running state back to the start - used to rewind a play (seek). */
	reset(): void {
		for (const j of Object.keys(this.counts) as Judgement[]) this.counts[j] = 0;
		this.combo = 0;
		this.maxCombo = 0;
		this.score = 0;
		this.hp = MAX_HP;
		this.failedIndex = -1;
		this.accEarned = 0;
		this.accPossible = 0;
		this.bonus = 100;
		this.judged = 0;
	}

	add(j: Judgement): void {
		this.counts[j]++;
		this.judged++;
		this.accEarned += ACCURACY[j];
		this.accPossible += ACCURACY[JUDGEMENT.MARVELOUS];

		this.bonus = Math.max(0, Math.min(100, this.bonus + HIT_BONUS[j]));

		this.hp = Math.max(0, Math.min(MAX_HP, this.hp + HP_VALUE[j](this.od)));
		if (!this.noFail && this.hp <= 0 && this.failedIndex < 0) this.failedIndex = this.judged;

		const max = MAX_SCORE * 0.5 / this.maxObjects;
		const base_score = max * (HIT_VALUE[j] / HIT_VALUE[JUDGEMENT.MARVELOUS]);
		const bonus_score = max * (BONUS_VALUE[j] * Math.sqrt(this.bonus) / HIT_VALUE[JUDGEMENT.MARVELOUS]);
		this.score += base_score + bonus_score;

		if (j === JUDGEMENT.MISS) {
			this.combo = 0;
		} else {
			this.combo++;
			if (this.combo > this.maxCombo) this.maxCombo = this.combo;
		}
	}

	get accuracy(): number {
		return this.accPossible === 0 ? 1 : this.accEarned / this.accPossible;
	}

	get MISS(): number {
		return this.counts[JUDGEMENT.MISS];
	}

	get failed(): boolean {
		return this.failedIndex >= 0;
	}

	get grade (): Grade {
		if (this.failed) return GRADE.D;
		if (this.counts[JUDGEMENT.PERFECT] === 0
			&& this.counts[JUDGEMENT.GREAT] === 0
			&& this.counts[JUDGEMENT.GOOD] === 0
			&& this.counts[JUDGEMENT.BAD] === 0
			&& this.counts[JUDGEMENT.MISS] === 0
		) return GRADE.X;
		if (this.accuracy >= 1) return GRADE.SS;
		if (this.accuracy >= 0.95) return GRADE.S;
		if (this.accuracy >= 0.9) return GRADE.A;
		if (this.accuracy >= 0.8) return GRADE.B;
		if (this.accuracy >= 0.7) return GRADE.C;
		return GRADE.D;
	}
}
