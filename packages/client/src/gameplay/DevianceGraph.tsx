import {
	useEffect,
	useRef,
} from 'react';
import type { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import { drawDevianceGraph } from './hitError';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { currentSkin } from '../osu/skin/Skin';

/**
 * Result-screen canvas plotting hit deviation over the course of the song.
 * Width is responsive (fills its container); height is fixed by the prop.
 */
export default function DevianceGraph({ 
	game, 
	height = 190,
}: { 
	game: ManiaGame, 
	height?: number 
}) {
	const [skin] = useSynced(currentSkin);
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current!;
		const ctx = canvas.getContext('2d')!;
		const draw = () => {
			const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			canvas.style.height = `${height}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			drawDevianceGraph(skin, ctx, {
				hits: game.hits,
				windows: game.windows,
				songEndMs: game.songEndMs,
				width,
				height,
			});
		};
		draw();
		const ro = new ResizeObserver(draw);
		ro.observe(canvas);
		return () => ro.disconnect();
	}, [game, height]);

	return <canvas ref={ref} className="play__graph" />;
}
