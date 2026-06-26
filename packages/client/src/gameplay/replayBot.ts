import {
	Bot,
	type BotContext,
	type InputEvent,
} from '@osu-idle/shared/sim/bot';
import { ReplayOffset } from '@osu-idle/shared/sim/maniaGame';
import type RuntimeNote from '@osu-idle/shared/sim/runtimeNote';

/**
 * Replays a server-computed play: instead of generating timing error from the
 * character's skills, it emits the exact per-input offsets the server's bot
 * produced. Because judgement is pure given `(offset, windows)`, feeding these
 * through `ManiaGame` reproduces the server's score exactly. A null offset is an
 * intentional miss (Infinity → ignored input), matching the base bot.
 *
 * Offsets arrive a few seconds at a time (anti-cheat: the client must not know
 * the whole outcome up front), so only the inputs streamed so far become events;
 * the rest are added later via {@link addOffsets} + `ManiaGame.appendReplay`.
 */
export default class ReplayBot extends Bot {
	private offsets: ReplayOffset[];
	private byId = new Map<string, RuntimeNote>();
	/** inputs already turned into events, keyed `id:tail` so re-sent offsets are ignored */
	private seen = new Set<string>();

	constructor(offsets: ReplayOffset[]) {
		super();
		this.offsets = [...offsets];
	}

	// unused - generateEvents is overridden to emit from the streamed offsets
	pressOffset(): number { return 0; }
	releaseOffset(): number { return 0; }

	generateEvents(ctx: BotContext): InputEvent[] {
		for (const note of ctx.notes) this.byId.set(note.getId(), note);
		const events = this.build(this.offsets);
		ctx.inputs = events;
		events.sort((a, b) => a.time - b.time);
		return events;
	}

	/** Fold a streamed chunk of offsets in, returning the input events it adds. */
	addOffsets(offsets: ReplayOffset[]): InputEvent[] {
		return this.build(offsets);
	}

	private build(offsets: ReplayOffset[]): InputEvent[] {
		const events: InputEvent[] = [];
		for (const o of offsets) {
			const key = `${o.id}:${o.tail ? 1 : 0}`;
			if (this.seen.has(key)) continue;
			const note = this.byId.get(o.id);
			if (!note) continue;
			this.seen.add(key);
			const off = o.offset == null ? Infinity : o.offset;
			events.push({
				time: (o.tail ? note.endTime : note.time) + off,
				column: note.column,
				action: o.tail ? 'release' : 'press',
				note,
				tail: !!o.tail,
				ignore: !isFinite(off),
			});
		}
		return events;
	}
}
