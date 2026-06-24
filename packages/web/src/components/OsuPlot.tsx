import './OsuPlot.css';

import {
	useEffect,
	useMemo,
	useState,
} from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// Type-only: plotly stays out of the module graph (vite externalizes it) and is
// loaded at runtime by the <script> below, so only the namespace types remain.
import type Plotly from 'plotly.js-dist-min';

type PlotComponent = ReturnType<typeof createPlotlyComponent>;

declare global {
	interface Window { Plotly?: object }
}

// The prebuilt plotly bundle (~4.7MB) is copied to dist/assets verbatim and
// injected on demand the first time a chart mounts, so it never touches the main
// bundle nor vite's minifier. The promise is module-level so concurrent charts
// share one load.
let plotlyPromise: Promise<object> | undefined;
function loadPlotly(): Promise<object> {
	if (window.Plotly) return Promise.resolve(window.Plotly);
	plotlyPromise ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = 'https://osu.idle.rhythmgamers.net/web/assets/plotly.min.js';
		script.async = true;
		script.onload = () => window.Plotly ? 
			resolve(window.Plotly) 
			: reject(new Error('plotly failed to load'));
		script.onerror = () => reject(new Error('plotly failed to load'));
		document.head.appendChild(script);
	});
	return plotlyPromise;
}

/** Reads a CSS custom property off :root so the chart tracks the site theme. */
function cssVar(name: string, fallback: string): string {
	if (typeof window === 'undefined') return fallback;
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

export interface OsuSeries {
	name: string;
	x: (number | string)[];
	y: number[];
	/** Hex/HSL accent for the line + area fill. Defaults to the theme pink. */
	color?: string;
	/** Deep-merged over the computed trace - override any plotly trace prop. */
	trace?: Partial<Plotly.PlotData>;
}

export interface OsuPlotProps {
	title?: string;
	series: OsuSeries[];
	height?: number;
	/** Optional axis labels. */
	xTitle?: string;
	yTitle?: string;
	/** How the hovered y value is rendered. A d3 format string (e.g. `,.0f`), or
	 *  a function for custom formatting (see {@link precise4}). Defaults to
	 *  `,.0f` (thousands-grouped integer). */
	yHoverFormat?: string | ((y: number) => string);
	/** Deep-merged over the computed layout - override any plotly layout prop
	 *  (e.g. `{ yaxis: { type: 'log' } }`). */
	layout?: Partial<Plotly.Layout>;
	/** Deep-merged over the default plotly config. */
	config?: Partial<Plotly.Config>;
}

/** osu!-web styled line chart: dark transparent panel, smooth lines with a
 *  soft area gradient, minimal gridlines, unified hover. Every computed trace,
 *  layout, and config field can be overridden via the matching prop. */
export default function OsuPlot({ 
	title, 
	series, 
	height = 320, 
	xTitle, 
	yTitle,
	yHoverFormat = ',.0f', 
	layout: layoutOverride,
	config: configOverride, 
}: OsuPlotProps,
) {
	const [Plot, setPlot] = useState<PlotComponent | null>(null);
	useEffect(() => {
		let alive = true;
		loadPlotly().then((plotly) => alive && setPlot(() => createPlotlyComponent(plotly)));
		return () => { alive = false; };
	}, []);

	const pink = cssVar('--pink', '#ff66aa');
	const text = cssVar('--text', '#f3eef1');
	const muted = cssVar('--muted', '#b3a6ad');
	const grid = `hsla(${cssVar('--base-hue', '333')}, 20%, 60%, .12)`;

	const data = useMemo(() => series.map((s): Partial<Plotly.PlotData> => {
		const color = s.color ?? pink;
		const base: Partial<Plotly.PlotData> = {
			name: s.name,
			x: s.x,
			y: s.y,
			type: 'scatter',
			mode: 'lines',
			line: {
				color, width: 2.5, shape: 'spline', smoothing: 0.6, 
			},
			fill: 'tozeroy',
			fillcolor: toAlpha(color, 0.12),
			// d3 format strings live in the template; a JS formatter is applied
			// per-point and surfaced through `text`.
			...(typeof yHoverFormat === 'function'
				? {
					text: s.y.map(yHoverFormat), hovertemplate: '%{text}<extra></extra>', 
				}
				: { hovertemplate: `%{y:${yHoverFormat}}<extra></extra>` }),
		};
		return deepMerge(base, s.trace);
	}), [series, pink, yHoverFormat]);

	const layout = useMemo((): Partial<Plotly.Layout> => {
		const base: Partial<Plotly.Layout> = {
			height,
			margin: {
				l: 56, r: 24, t: title ? 44 : 16, b: 40, 
			},
			paper_bgcolor: 'transparent',
			plot_bgcolor: 'transparent',
			font: {
				family: 'Torus, "Segoe UI", sans-serif', color: muted, size: 12, 
			},
			showlegend: series.length > 1,
			legend: {
				orientation: 'h', y: 1.08, x: 0, font: { color: muted }, 
			},
			hovermode: 'x unified',
			hoverlabel: {
				bgcolor: cssVar('--bg-2', '#2a2227'), bordercolor: pink, font: { color: text }, 
			},
			xaxis: {
				gridcolor: grid,
				zeroline: false,
				tickfont: { color: muted },
				showline: false,
				...(xTitle && {
					title: {
						text: xTitle, font: { color: muted }, 
					}, 
				}),
			},
			yaxis: {
				gridcolor: grid,
				zeroline: false,
				tickfont: { color: muted },
				showline: false,
				...(yTitle && {
					title: {
						text: yTitle, font: { color: muted }, 
					}, 
				}),
			},
			...(title && {
				title: {
					text: title, font: {
						color: text, size: 15, 
					}, x: 0, xanchor: 'left', 
				}, 
			}),
		};
		return deepMerge(base, layoutOverride);
	}, [title, height, text, muted, pink, grid, series.length, xTitle, yTitle, layoutOverride]);

	const config = useMemo((): Partial<Plotly.Config> =>
		deepMerge<Partial<Plotly.Config>>({
			displayModeBar: false, responsive: true, 
		}, configOverride),
	[configOverride]);

	// Reserve the chart's height while plotly streams in so layout doesn't jump.
	if (!Plot) return <div className="osu-plot" style={{ height: `${height}px` }} />;

	return (
		<div className="osu-plot">
			<Plot
				data={data}
				layout={layout}
				config={config}
				useResizeHandler
				style={{
					width: '100%', height: `${height}px`, 
				}}
			/>
		</div>
	);
}

/** Recursively merges `override` into `base` (override wins; nested plain
 *  objects merge, arrays/primitives replace). Returns a fresh object so the
 *  caller's defaults are never mutated. */
function deepMerge<T extends object>(base: T, override?: Partial<T>): T {
	if (!override) return base;
	const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [key, value] of Object.entries(override)) {
		const prev = out[key];
		if (isPlainObject(prev) && isPlainObject(value)) {
			out[key] = deepMerge(prev, value);
		} else if (value !== undefined) {
			out[key] = value;
		}
	}
	return out as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 4 digits of precision: 4 significant figures for fractional values
 *  (`0.8874`, `0.004571`, `10.24`), full grouped integer once `|y| >= 1000`
 *  (`10,548`). For hovering small factors where `,.0f` rounds to a useless `1`. */
export function precise4(y: number): string {
	if (Math.abs(y) >= 1000) return Math.round(y).toLocaleString('en-US');
	const s = y.toPrecision(4);
	return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Converts a #rrggbb or hsl()/named color to an rgba/hsla with the given alpha
 *  for the area fill. Falls back to wrapping the raw value where possible. */
function toAlpha(color: string, alpha: number): string {
	const hex = /^#([0-9a-f]{6})$/i.exec(color);
	if (hex) {
		const n = parseInt(hex[1], 16);
		return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
	}
	const hsl = /^hsl\((.+)\)$/i.exec(color);
	if (hsl) return `hsla(${hsl[1]}, ${alpha})`;
	return color;
}
