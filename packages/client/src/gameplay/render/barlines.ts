import {
	noteY,
	type Layer,
} from './frame';

/** the timing barlines scrolling down the playfield */
export const drawBarlines: Layer = (f) => {
	const { ctx, game, vp, g } = f;
	ctx.strokeStyle = 'rgba(255,255,255,0.16)';
	for (const bl of game.barlines) {
		const y = noteY(f, bl.time);
		if (y < -2 || y > vp.h + 2) continue;
		ctx.beginPath();
		ctx.moveTo(g.x0, y);
		ctx.lineTo(g.x0 + g.fieldWidth, y);
		ctx.stroke();
	}
};
