import './FancyGraph.css';

import { useMemo } from 'react';
import { curveMonotoneX, line } from 'd3-shape';

type Point = { x: number; y: number };

type Props = {
	/** The series to plot, oldest first. Index becomes the x position. */
	data: number[];
	width?: number;
	height?: number;
	/** Vertical inset (px) so the curve and trailing dot never clip. */
	margin?: number;
	className?: string;
};

/**
 * osu!-web style sparkline: a monotone spline with a dot on the latest point.
 * The smooth curve is produced by d3-shape's `curveMonotoneX` - the same
 * interpolation osu!-web uses for its `js-fancy-graph` charts.
 */
export default function FancyGraph({
	data,
	width = 325,
	height = 50,
	margin = 3,
	className,
}: Props) {
	const { path, last } = useMemo(() => {
		if (data.length === 0) return { path: null, last: null };

		const points: Point[] = data.map((y, x) => ({ x, y }));

		// A flat series would collapse the domain to a single value; pad it so the
		// line renders along the vertical centre instead of dividing by zero.
		let min = Math.min(...data);
		let max = Math.max(...data);
		if (min === max) { min -= 1; max += 1; }

		const lastX = Math.max(data.length - 1, 1);
		// Reserve `margin` on the right so the trailing dot stays inside the box.
		const scaleX = (x: number) => (x / lastX) * (width - margin);
		// SVG y grows downward, so the largest value maps to the smallest y.
		const scaleY = (y: number) =>
			height - margin - ((y - min) / (max - min)) * (height - margin * 2);

		const generate = line<Point>()
			.x(d => scaleX(d.x))
			.y(d => scaleY(d.y))
			.curve(curveMonotoneX);

		const lastPoint = points[points.length - 1];
		return {
			path: generate(points),
			last: { x: scaleX(lastPoint.x), y: scaleY(lastPoint.y) },
		};
	}, [data, width, height, margin]);

	if (!path || !last) return null;

	return (
		<svg className={`fancy-graph${className ? ` ${className}` : ''}`} width={width} height={height}>
			<g>
				<path className="fancy-graph__line" d={path} />
				<circle className="fancy-graph__circle" r={3} cx={last.x} cy={last.y} />
			</g>
		</svg>
	);
}
