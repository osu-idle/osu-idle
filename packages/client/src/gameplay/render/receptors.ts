import { colorA } from '@osu-idle/shared/types/color';
import type { Layer } from './frame';

/** the per-column receptors at the judgement line, flashing on a hit */
export const drawReceptors: Layer = ({ ctx, game, skin, now, g }) => {
	for (let c = 0; c < g.keys; c++) {
		const cx = g.x0 + c * skin.data.playfield.columnWidth;
		const glow = Math.max(0, 1 - (now - game.columnFlash[c]) / 140);
		ctx.strokeStyle = 'rgba(255,255,255,0.4)';
		ctx.lineWidth = 2;
		ctx.strokeRect(
			cx + 4,
			g.lineY - skin.data.playfield.receptorHeight,
			skin.data.playfield.columnWidth - 8,
			skin.data.playfield.receptorHeight,
		);
		if (glow > 0) {
			ctx.fillStyle = colorA(skin.data.hitObjects[c].color, 0.35 * glow);
			ctx.fillRect(
				cx + 4,
				g.lineY - skin.data.playfield.receptorHeight,
				skin.data.playfield.columnWidth - 8,
				skin.data.playfield.receptorHeight,
			);
		}
	}
};
