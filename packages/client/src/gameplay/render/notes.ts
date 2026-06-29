import {
	Color,
	colorA,
} from '@osu-idle/shared/types/color';
import Reading from '@osu-idle/shared/sim/skills/reading';
import {
	noteY,
	roundRect,
	type Frame,
	type Layer,
} from './frame';
import type { ManiaGame } from '@osu-idle/shared/sim/maniaGame';

type RenderNote = ManiaGame['notes'][number];

const drawHoldNote = (f: Frame, note: RenderNote, cx: number, color: Color) => {
	const { ctx, skin, now, vp, g } = f;
	if (note.tailJudged) {
		const broke = note.tailMissedAt;
		if (broke !== undefined) {
			// a dropped hold (tail miss - fumble or released way too soon): the body
			// remaining past the break point stays on screen, dimmed, and scrolls off
			// instead of vanishing instantly
			if (broke >= note.endTime) return;
			const yFrom = noteY(f, broke);
			const yTail = noteY(f, note.endTime);
			const top = Math.min(yFrom, yTail);
			const bottom = Math.max(yFrom, yTail);
			if (bottom < -2 || top > vp.h + 2) return;
			ctx.globalAlpha = 0.3;
			ctx.fillStyle = colorA(color, 0.5);
			ctx.fillRect(cx + 6, top, skin.data.playfield.columnWidth - 12, bottom - top);
			ctx.fillStyle = color;
			ctx.fillRect(
				cx + 4,
				yTail - skin.data.playfield.noteHeight,
				skin.data.playfield.columnWidth - 8,
				skin.data.playfield.noteHeight,
			);
			ctx.globalAlpha = 1;
			return;
		}
		// released cleanly but a touch early: keep drawing as if still held (head
		// pinned to the line) until the tail reaches the line - the hold finishes its
		// travel normally, no pop, no dimming
		if (now >= note.endTime) return;
		const yTail = noteY(f, note.endTime);
		ctx.fillStyle = colorA(color, 0.85);
		ctx.fillRect(
			cx + 6,
			Math.min(g.lineY, yTail),
			skin.data.playfield.columnWidth - 12,
			Math.abs(g.lineY - yTail),
		);
		ctx.fillStyle = color;
		ctx.fillRect(
			cx + 4,
			yTail - skin.data.playfield.noteHeight,
			skin.data.playfield.columnWidth - 8,
			skin.data.playfield.noteHeight,
		);
		ctx.fillRect(
			cx + 4,
			g.lineY - skin.data.playfield.noteHeight,
			skin.data.playfield.columnWidth - 8,
			skin.data.playfield.noteHeight,
		);
		return;
	}
	const yHead = note.holding ? g.lineY : noteY(f, note.time);
	const yTail = noteY(f, note.endTime);
	const top = Math.min(yHead, yTail);
	const bottom = Math.max(yHead, yTail);
	if (bottom < -2 || top > vp.h + 2) return;
	// body
	ctx.fillStyle = note.holding ? colorA(color, 0.85) : colorA(color, 0.5);
	ctx.fillRect(cx + 6, top, skin.data.playfield.columnWidth - 12, bottom - top);
	// tail cap
	ctx.fillStyle = color;
	ctx.fillRect(
		cx + 4,
		yTail - skin.data.playfield.noteHeight,
		skin.data.playfield.columnWidth - 8,
		skin.data.playfield.noteHeight,
	);
	// head cap - pinned to the receptor while held (the base stays visible),
	// otherwise tracking the head itself: approaching before the hit, and scrolling
	// on past the receptors once it's been missed (an unpressed note)
	ctx.fillRect(
		cx + 4,
		yHead - skin.data.playfield.noteHeight,
		skin.data.playfield.columnWidth - 8,
		skin.data.playfield.noteHeight,
	);
};

const drawTapNote = (f: Frame, note: RenderNote, cx: number, color: string) => {
	const { ctx, game, skin, vp } = f;
	if (note.headJudged) return;
	const y = noteY(f, note.time);
	if (y < -skin.data.playfield.noteHeight || y > vp.h + skin.data.playfield.noteHeight) return;
	ctx.fillStyle = color;
	roundRect(
		ctx,
		cx + 4,
		y - skin.data.playfield.noteHeight,
		skin.data.playfield.columnWidth - 8,
		skin.data.playfield.noteHeight, 4,
	);
	ctx.fill();

	if (f.opts.debug) {
		ctx.font = '700 10px "Exo 2", sans-serif';
		ctx.textAlign = 'center';
		ctx.fillStyle = 'black';
		ctx.fillText(`1/${note.snap}`, cx + 4 + (skin.data.playfield.columnWidth - 8) / 2, y);
		ctx.fillText(
			Reading.countTransitions(
				new Map(),
				game.visibleNotesAt(note.time),
			).toString(),
			cx + 4 + (skin.data.playfield.columnWidth - 8) / 2,
			y + 9,
		);
	}
};

/** the hit objects - tap notes and hold (long) notes */
export const drawNotes: Layer = (f) => {
	const { game, skin, g } = f;
	for (const note of game.notes) {
		const cx = g.x0 + note.column * skin.data.playfield.columnWidth;
		const color = skin.data.hitObjects[note.column].color;
		if (note.hold) drawHoldNote(f, note, cx, color);
		else drawTapNote(f, note, cx, color);
	}
};
