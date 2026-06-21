import Skin from '../osu/skin/Skin';

interface HpBarOpts {
	/** current health, 0..1 (already eased) */
	hp: number
	/** left edge x of the bar */
	x: number
	/** y of the bar's bottom edge */
	bottom: number
}

/**
 * The live vertical HP bar next to the playfield: a track with a fill that grows
 * from the bottom by the current health, tinting red once it runs low. Drawn on
 * the canvas (before the hit-error bar) so that bar stays on top of it.
 */
export function drawHpBar(ctx: CanvasRenderingContext2D, opts: HpBarOpts): void {
	const { hp, x, bottom } = opts;
	const { width, height, radius, background, fill, fillLow, lowThreshold } = Skin.hpBar;

	ctx.fillStyle = background;
	roundRect(ctx, x, bottom - height, width, height, radius);
	ctx.fill();

	const fillH = Math.max(0, Math.min(1, hp)) * height;
	if (fillH > 0) {
		ctx.fillStyle = hp <= lowThreshold ? fillLow : fill;
		roundRect(ctx, x, bottom - fillH, width, fillH, radius);
		ctx.fill();
	}
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const rr = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rr, y);
	ctx.arcTo(x + w, y, x + w, y + h, rr);
	ctx.arcTo(x + w, y + h, x, y + h, rr);
	ctx.arcTo(x, y + h, x, y, rr);
	ctx.arcTo(x, y, x + w, y, rr);
	ctx.closePath();
}
