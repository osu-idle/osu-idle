import { useEffect, useRef } from 'react';
import type { HitRecord } from '@osu-idle/shared/sim/maniaGame';
import type { HitWindows } from './judgement';
import { drawDevianceGraph } from './hitError';

interface Props {
	hits: HitRecord[]
	windows: HitWindows
	songEndMs: number
	failMs?: number
	overlay?: { time: number, value: number }[]
	width?: number
	height?: number
}

/** A standalone deviance graph for an arbitrary set of hit records. */
export default function StrainGraph({ hits, windows, songEndMs, failMs, overlay, width = 320, height = 130 }: Props) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current!;
		const ctx = canvas.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		drawDevianceGraph(ctx, { hits, windows, songEndMs, failMs, overlay, width, height });
	}, [hits, windows, songEndMs, failMs, overlay, width, height]);
	return <canvas ref={ref} className="strain__canvas" />;
}
