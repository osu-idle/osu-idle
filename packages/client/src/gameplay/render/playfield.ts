import type { Layer } from './frame';

/** the playfield backdrop and its column separators */
export const drawPlayfield: Layer = ({ ctx, skin, vp, g }) => {
	ctx.fillStyle = 'rgba(0,0,0,0.55)';
	ctx.fillRect(g.x0, 0, g.fieldWidth, vp.h);
	ctx.strokeStyle = 'rgba(255,255,255,0.06)';
	ctx.lineWidth = 1;
	for (let c = 0; c <= g.keys; c++) {
		ctx.beginPath();
		ctx.moveTo(g.x0 + c * skin.data.playfield.columnWidth + 0.5, 0);
		ctx.lineTo(g.x0 + c * skin.data.playfield.columnWidth + 0.5, vp.h);
		ctx.stroke();
	}
};
