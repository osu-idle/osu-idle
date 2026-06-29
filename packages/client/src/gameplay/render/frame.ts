import type { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import type CharacterBot from '@osu-idle/shared/sim/bots/character';
import type Skin from '../../osu/skin/Skin';
import {
	SKILL,
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import { skillName } from '@osu-idle/shared/display/skills';
import { type Grade } from '@osu-idle/shared/judgement';

export type Viewport = {
	w: number,
	h: number,
	/** approach span in scroll units (ms a note is visible) - lower = faster scroll */
	scrollMs: number,
};

/** screen geometry derived from the viewport, the key count and the skin sizes */
export type PlayfieldGeometry = {
	keys: number,
	fieldWidth: number,
	/** y of the receptor / judgement line */
	lineY: number,
	pxPerUnit: number,
	/** left edge of the centred playfield */
	x0: number,
};

export type StrainHud = {
	/** the bot whose live strain feeds the gauges */
	bot: CharacterBot,
	labels: Record<SkillName, string>,
};

export type DrawOptions = {
	debug?: boolean,
	/** stacks the top-right accuracy/score lower (narrow screens) */
	mobile?: boolean,
	/** draws the per-skill strain gauges when set */
	strain?: StrainHud,
	/** fired only when the live grade changes (drive a DOM grade badge from it) */
	onGrade?: (grade: Grade) => void,
};

/** everything a layer needs to paint one frame */
export type Frame = {
	ctx: CanvasRenderingContext2D,
	game: ManiaGame,
	skin: Skin,
	/** song time in ms */
	now: number,
	vp: Viewport,
	g: PlayfieldGeometry,
	opts: DrawOptions,
};

/** one stacked render layer - paints itself onto the frame's canvas */
export type Layer = (f: Frame) => void;

export const playfieldGeometry = (
	game: ManiaGame,
	skin: Skin,
	vp: Viewport,
): PlayfieldGeometry => {
	const keys = game.keyCount;
	const fieldWidth = keys * skin.data.playfield.columnWidth;
	const lineY = vp.h - skin.data.playfield.hitPosition;
	return {
		keys,
		fieldWidth,
		lineY,
		pxPerUnit: lineY / vp.scrollMs,
		x0: (vp.w - fieldWidth) / 2,
	};
};

/** y of a note at song time `time`, given the current `now`. */
export const noteY = (f: Frame, time: number): number =>
	f.g.lineY
	- (f.game.scroll.positionAt(time) - f.game.scroll.positionAt(f.now))
	* f.g.pxPerUnit;

export const roundRect = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) => {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
};

// skills whose live strain is meaningful to watch - the rest are hidden from the
// strain HUD (accuracy is a level constant; memory has no press strain of its own
// - it only reduces SpeedJam's)
export const STRAIN_HUD_HIDDEN = new Set<SkillName>([
	SKILL.accuracy,
	SKILL.memory,
	SKILL.consistency,
]);
export const STRAIN_HUD_SKILLS = Skills.filter(s => !STRAIN_HUD_HIDDEN.has(s));

/** per-skill display labels for the strain HUD, in the active locale */
export const strainLabels = (): Record<SkillName, string> =>
	Object.fromEntries(Skills.map(s => [s, skillName(s)])) as Record<SkillName, string>;
