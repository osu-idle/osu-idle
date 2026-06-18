import { JUDGEMENT, Judgements } from '@osu-idle/shared/judgement';
import type { HitRecord } from '@osu-idle/shared/sim/maniaGame';
import Skin from '../osu/skin/Skin';
import { HitWindows } from '@osu-idle/shared/sim/scoring';

export { unstableRate } from '@osu-idle/shared/sim/maniaGame';

/** parse a #rrggbb or rgba(...) colour into [r, g, b, a] */
function parseColor(c: string): [number, number, number, number] {
	if (c[0] === '#') {
		const n = parseInt(c.slice(1), 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
	}
	const [r, g, b, a] = c.slice(c.indexOf('(') + 1, c.indexOf(')')).split(',').map(Number);
	return [r, g, b, a];
}
/** apply alpha to a colour */
function colorA(c: string, a: number): string {
	const [r, g, b] = parseColor(c);
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}
/** dim a colour, keeping its alpha */
function colorDim(c: string, dim: number): string {
	const [r, g, b, a] = parseColor(c);
	return `rgba(${Math.floor(r * dim)}, ${Math.floor(g * dim)}, ${Math.floor(b * dim)}, ${a})`;
}

function meanOffset(hits: HitRecord[]): number | null {
	let sum = 0;
	let n = 0;
	for (const h of hits) {
		if (h.offset != null) {
			sum += h.offset;
			n++;
		}
	}
	return n > 0 ? sum / n : null;
}

interface BarOpts {
	windows: HitWindows
	hits: HitRecord[]
	now: number
	cx: number
	y: number
	halfWidth: number
}

/**
 * The live hit-error bar: coloured judgement zones around centre, fading ticks
 * for recent hits, and an arrow marking the running mean offset (bias).
 */
export function drawHitErrorBar(ctx: CanvasRenderingContext2D, opts: BarOpts): void {
	const { windows, hits, now, cx, y, halfWidth } = opts;
	const miss = windows[JUDGEMENT.MISS];
	const scale = (halfWidth * 1.3) / miss;
	const barH = 8;

	// concentric zones: each judgement fills only the ring between the next-tighter
	// window and its own, mirrored left/right, so the translucent fills don't stack.
	let prevWin = 0;
	for (const j of Judgements) {
		const win = windows[j] * scale;
		ctx.fillStyle = colorA(colorDim(Skin.judgeColor(j), 1.35), 0.2);
		ctx.fillRect(cx + prevWin, y - barH / 2, win - prevWin, barH);
		ctx.fillRect(cx - win, y - barH / 2, win - prevWin, barH);
		prevWin = win;
	}
	// centre (perfect) line
	ctx.fillStyle = 'rgba(255,255,255,0.9)';
	ctx.fillRect(cx - 1, y - barH, 2, barH * 2);

	// recent hit ticks, fading out. Misses never tick the bar - it reads the
	// timing quality of successful hits only.
	const FADE = 2500;
	// 'lighten' so ticks stacked at the same offset take the brighter pixel
	// instead of summing - a cluster near centre stays as bright as its newest
	// tick rather than blowing out to a saturated column.
	ctx.globalCompositeOperation = 'lighten';
	for (const h of hits) {
		if (h.offset == null || h.judgement === JUDGEMENT.MISS) continue;
		const age = now - h.time;
		if (age < 0 || age > FADE) continue;
		const off = Math.max(-miss, Math.min(miss, h.offset));
		ctx.globalAlpha = 1 - age / FADE;
		ctx.fillStyle = Skin.judgeColor(h.judgement);
		ctx.fillRect(cx + off * scale - 1, y - barH - 2, 2, barH * 2 + 4);
	}
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'source-over';

	// mean / bias arrow
	const mean = meanOffset(hits);
	if (mean != null) {
		const mx = cx + Math.max(-miss, Math.min(miss, mean)) * scale;
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.moveTo(mx, y - barH - 4);
		ctx.lineTo(mx - 4, y - barH - 11);
		ctx.lineTo(mx + 4, y - barH - 11);
		ctx.closePath();
		ctx.fill();
	}
}

interface GraphOpts {
	hits: HitRecord[]
	windows: HitWindows
	songEndMs: number
	width: number
	height: number
	/** song time (ms) at which the play failed, drawn as a vertical bar */
	failMs?: number
	/** an extra 0..1 curve drawn as a white line over the graph's full height */
	overlay?: { time: number, value: number }[]
}

/**
 * The result-screen deviance graph: every note's signed timing error plotted
 * over the song, with judgement-window bands, the mean line, and misses marked
 * at the edges.
 */
export function drawDevianceGraph(ctx: CanvasRenderingContext2D, opts: GraphOpts): void {
	const { hits, windows, songEndMs, width, height, failMs } = opts;
	const miss = windows[JUDGEMENT.MISS];
	const padX = 10;
	const padY = 10;
	const gw = width - padX * 2;
	const gh = height - padY * 2;
	const midY = padY + gh / 2;
	const yFor = (off: number) => midY - (off / miss) * (gh / 2);
	const xFor = (t: number) => padX + (songEndMs > 0 ? t / songEndMs : 0) * gw;

	ctx.clearRect(0, 0, width, height);

	// judgement-window bands: concentric rings around the centre, each spanning
	// from the next-tighter window out to its own, mirrored early (top) and late
	// (bottom) so the zones tile the graph without overlapping.
	let prevWin = 0;
	for (const j of Judgements) {
		const win = windows[j];
		ctx.fillStyle = colorDim(colorA(Skin.judgeColor(j), 0.15), 1.35);
		ctx.fillRect(padX, yFor(win), gw, yFor(prevWin) - yFor(win));
		ctx.fillRect(padX, yFor(-prevWin), gw, yFor(-win) - yFor(-prevWin));
		prevWin = win;
	}

	// centre (0) line
	ctx.strokeStyle = 'rgba(255,255,255,0.45)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(padX, midY);
	ctx.lineTo(width - padX, midY);
	ctx.stroke();

	// points. A miss is marked at both edges like a full miss; a landed hit is a
	// dot at its (signed) error, clamped to the scale so a long note's large
	// combined error still reads as a coloured dot at the edge, not a miss.
	for (const h of hits) {
		const x = xFor(h.time);
		if (h.offset == null || h.judgement === JUDGEMENT.MISS) {
			ctx.fillStyle = Skin.judgeColor(JUDGEMENT.MISS);
			ctx.fillRect(x - 1, padY, 2, 5);
			ctx.fillRect(x - 1, height - padY - 5, 2, 5);
		} else {
			const off = Math.max(-miss, Math.min(miss, h.offset));
			ctx.fillStyle = Skin.judgeColor(h.judgement);
			ctx.fillRect(x - 1.2, yFor(off) - 1.2, 2.4, 2.4);
		}
	}

	// mean line
	const mean = meanOffset(hits);
	if (mean != null) {
		ctx.strokeStyle = 'rgba(255,255,255,0.55)';
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(padX, yFor(mean));
		ctx.lineTo(width - padX, yFor(mean));
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// overlay curve (e.g. consistency's pressure): 0 at the bottom, 1 at the top
	if (opts.overlay && opts.overlay.length > 0) {
		ctx.strokeStyle = 'rgba(255,255,255,0.85)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		opts.overlay.forEach((p, i) => {
			const x = xFor(p.time);
			const y = padY + (1 - Math.max(0, Math.min(1, p.value))) * gh;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		});
		ctx.stroke();
	}

	// fail marker: vertical red bar at the moment HP hit 0
	if (failMs != null) {
		const fx = xFor(failMs);
		ctx.fillStyle = Skin.judgeColor(JUDGEMENT.MISS);
		ctx.fillRect(fx - 1, padY, 2, gh);
	}
}
