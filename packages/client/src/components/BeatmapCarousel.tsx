import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import {
	Trans,
	Plural,
} from '@lingui/react/macro';
import './BeatmapCarousel.css';
import BeatmapCard from './BeatmapCard';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import LightBeatmapSet from '../osu/beatmap/LightBeatmapSet';
import { music } from '../audio/MusicPlayer';
import Controls from '../input/Controls';
import RightClick from '../input/RightClick';

export type DownloadStatus = 'idle' | 'downloading' | 'done';

export type DownloadState = {
	status: DownloadStatus,
	progress: number,
};

/** one carousel card = one difficulty, paired with its parent set */
export type CarouselItem = {
	beatmap: LightBeatmap,
	set: LightBeatmapSet,
};

export type CarouselHeaderRow = { 
	type: 'header', 
	key: string, 
	label: string, 
	count: number, 
	collapsed: boolean ,
};

/** A single virtualised row: either a difficulty card or a collapsible group
 *  header. Headers are the same height as cards so the uniform-STRIDE
 *  virtualisation (and the arc) hold regardless of grouping. */
export type CarouselRow =
	| { type: 'card', item: CarouselItem }
	| CarouselHeaderRow;

interface Props {
	rows: CarouselRow[]
	/** single click - select (and preview), or start if already selected */
	onCardClick: (beatmap: LightBeatmap) => void
	/** double click - download the set's .osz */
	onCardDoubleClick: (beatmap: LightBeatmap) => void
	/** right click (without dragging) - open the card's contextual menu */
	onCardRightClick: (item: CarouselItem) => void
	hasDownloaded: boolean
	/** toggle a group header's collapsed state, by its key */
	onToggleGroup: (key: string) => void
	/** still loading the library */
	loading: boolean
	/** download state keyed by set .osz stem */
	downloads: Record<number, DownloadState>
	/** total difficulties matching the search (for the footer; ignores collapse) */
	totalCount: number
}

/**
 * A collapsible group header row.
 * Shares `.bm-card` so it rides the same arc.
 */
function GroupHeader({ label, count, collapsed, onToggle }: {
	label: string, count: number, collapsed: boolean, onToggle: () => void,
}) {
	return (
		<div 
			className={`bm-card bm-group ${collapsed ? 'is-collapsed' : 'is-selected'}`} 
			onClick={onToggle}
		>
			<span 
				className="bm-group__label"
			>
				{label} (<Plural value={count} one="# map" other="# maps" />)
			</span>
		</div>
	);
}

/**
 * The radius (in half-heights) of the circle the carousel panels ride on.
 * This is the exact constant osu! uses; it gives the panels that signature
 * curve where the centre bows out to the left and the ends recede right.
 */
const CIRCLE_RADIUS = 3;

/**
 * Extra cards mounted above/below the viewport so a fast flick never blanks.
*/
const OVERSCAN = 5;
/** Card box height + bottom margin - must match the CSS (.bm-card). */
const CARD_HEIGHT = 100;
const CARD_MARGIN = 5;
const STRIDE = CARD_HEIGHT + CARD_MARGIN;

/**
 * osu!'s panel horizontal offset. `dist` is the panel's distance from the
 * vertical centre, normalised so 0 = dead centre and 1 = top/bottom edge.
 * Returns how far (px) the panel should be pushed back toward the right edge.
 */
function offsetX(dist: number, halfHeight: number): number {
	const discriminant = Math.max(0, CIRCLE_RADIUS * CIRCLE_RADIUS - dist * dist);
	return (CIRCLE_RADIUS - Math.sqrt(discriminant)) * halfHeight;
}

/**
 * The vertical, osu!-style carousel. Each card is a single difficulty; the
 * whole library is loaded and sorted globally by star rating. Single-click
 * selects (and previews); clicking an already selected, downloaded card starts
 * play; double-click downloads the set.
 *
 * The panels ride a circular arc (just like osu! stable): the card nearest the
 * vertical centre protrudes furthest left and cards above/below curve away to
 * the right. Selecting a card smoothly scrolls it to the centre.
 *
 * **Virtualisation.** The library can be hundreds of maps, so only the cards
 * near the viewport are mounted; the rest are stand-in spacer divs of the exact
 * height (cards are a fixed `STRIDE` apart).
 * 
 * The smooth-scroll animation and the
 * arc are pure DOM - they never call setState. The mounted window is updated
 * only from the scroll event, which the browser also fires for the animation's
 * programmatic scrolls, so a React re-render can never feed back into the
 * animation loop (that was the source of earlier render storms).
 */
export default function BeatmapCarousel({
	rows,
	onCardClick,
	onCardDoubleClick,
	onCardRightClick,
	onToggleGroup,
	hasDownloaded,
	loading,
	downloads,
	totalCount,
}: Props) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef(0);
	// the scrollTop we're easing toward; null = no animation in flight
	const targetRef = useRef<number | null>(null);
	const animRef = useRef(0);
	// timestamp of the previous animation frame, for time-based easing
	const lastTsRef = useRef(0);

	// the slice of `rows` currently mounted; everything else is a spacer
	const [range, setRange] = useState({
		start: 0, end: 0, 
	});
	const rangeRef = useRef(range);
	// live rows, for the centering glide: music.beatmap.use() captures its
	// callback once and so can't close over the latest `rows` prop.
	const rowsRef = useRef(rows);
	rowsRef.current = rows;

	/**
	 * The scroller's top padding (the carousel is padded so the ends can centre).
	 */
	const padTop = useCallback((): number => {
		const scroller = scrollRef.current;
		return scroller ? parseFloat(getComputedStyle(scroller).paddingTop) || 0 : 0;
	}, []);

	/** Which cards should be mounted for the current scroll position. */
	const syncWindow = useCallback(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const first = Math.floor((scroller.scrollTop - padTop()) / STRIDE);
		const visible = Math.ceil(scroller.clientHeight / STRIDE);
		const start = Math.max(0, first - OVERSCAN);
		const end = Math.min(rows.length, Math.max(start, first + visible + OVERSCAN));
		if (start !== rangeRef.current.start || end !== rangeRef.current.end) {
			rangeRef.current = {
				start, end, 
			};
			setRange({
				start, end, 
			});
		}
	}, [rows.length, padTop]);

	/**
	 * Re-apply the circular-arc offset to every mounted card. Pure DOM, no state.
	 */
	const updateCurve = useCallback(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const halfHeight = scroller.clientHeight / 2;
		if (halfHeight <= 0) return;
		const scrollTop = scroller.scrollTop;
		const cards = scroller.querySelectorAll<HTMLElement>('.bm-card');
		for (const card of cards) {
			// panel centre relative to the top of the viewport
			const drawY = card.offsetTop + card.offsetHeight / 2 - scrollTop;
			// 0 at centre, 1 at the top/bottom edges (clamped beyond)
			const dist = Math.abs(1 - drawY / halfHeight);
			card.style.setProperty('--bow', `${offsetX(dist, halfHeight)}px`);
		}
	}, []);

	/**
	 * Ease scrollTop toward `targetRef`. The smoothing is *time-based* (the rate
	 * is converted to the elapsed frame time), so a momentary main-thread stall -
	 * e.g. the synchronous .osz unzip when a downloaded map is selected - is
	 * absorbed as a single catch-up rather than re-easing from where it froze.
	 * Pure DOM: writes scrollTop and the arc, never React state. The mounted
	 * window keeps up because each scrollTop write fires a scroll event (onScroll).
	 */
	const stepScroll = useCallback(
		(ts: number) => {
			const scroller = scrollRef.current;
			if (!scroller || targetRef.current === null) {
				animRef.current = 0;
				return;
			}
			// elapsed time since the last frame (0 on the first frame of a run)
			const dt = lastTsRef.current ? ts - lastTsRef.current : 0;
			lastTsRef.current = ts;

			const current = scroller.scrollTop;
			const diff = targetRef.current - current;
			// < 1px: some browsers round scrollTop to whole pixels, so a fractional
			// target would never cross a sub-pixel threshold and the glide (and its
			// per-frame work) would spin forever.
			if (Math.abs(diff) < 1) {
				scroller.scrollTop = targetRef.current;
				targetRef.current = null;
				animRef.current = 0;
				updateCurve();
				return;
			}
			// frame-rate-independent exponential smoothing: reach ~0.2/frame @60fps,
			// but after a long stall dt is large so we snap most of the way at once.
			const factor = 1 - Math.pow(1 - 0.22, dt / 16.6667);
			scroller.scrollTop = current + diff * factor;
			updateCurve();
			animRef.current = requestAnimationFrame(stepScroll);
		},
		[updateCurve],
	);

	/**
	 * Point the animator at a clamped scroll target (wheel, scrollbar, centering).
	 */
	const animateTo = useCallback(
		(top: number) => {
			const scroller = scrollRef.current;
			if (!scroller) return;
			const max = scroller.scrollHeight - scroller.clientHeight;
			targetRef.current = Math.max(0, Math.min(max, top));
			if (!animRef.current) {
				lastTsRef.current = 0;
				animRef.current = requestAnimationFrame(stepScroll);
			}
		},
		[stepScroll],
	);

	/**
	 * osu!-style right-drag scrub: map the cursor's vertical position in the
	 * viewport straight to a scroll fraction and jump there immediately (no glide).
	 * Lets you cross thousands of results in one drag. Cancels any in-flight glide
	 * so it doesn't fight the scrub for scrollTop.
	 */
	const scrubTo = useCallback((clientY: number) => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const rect = scroller.getBoundingClientRect();
		const frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
		targetRef.current = null;
		scroller.scrollTop = frac * (scroller.scrollHeight - scroller.clientHeight);
		updateCurve();
	}, [updateCurve]);

	/**
	 * Glide the selected card to the vertical centre. The target is the card's
	 * *index* position (cards are a fixed stride apart), so it works even when the
	 * active card is currently virtualised out - e.g. re-entering song select
	 * scrolled to the top with a far-down selection.
	 */
	// the beatmap id we last glided to, so a mere collapse/expand (which rebuilds
	// `rows`) doesn't yank the view back to the selection in some other group.
	const lastCenteredRef = useRef<number | null>(null);
	const centerOnActive = useCallback(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const current = music.beatmap.get();
		const i = current
			? rowsRef.current
				.findIndex(r => r.type === 'card' && r.item.beatmap.is(current))
			: -1;
		if (i < 0) return;
		lastCenteredRef.current = current!.metadata.id;
		const cardCentre = padTop() + i * STRIDE + CARD_HEIGHT / 2;
		animateTo(cardCentre - scroller.clientHeight / 2);
	}, [animateTo, padTop]);

	// Take over the mouse wheel so scrolling is always smooth, never harsh.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey) return; // let pinch-zoom through
			e.preventDefault();
			// don't scroll when holding alt (volume)
			if (Controls.mode_Alt.get()) return;
			// normalise line/page deltas to pixels
			const unit =
				e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroller.clientHeight : 1;
			const base = targetRef.current ?? scroller.scrollTop;
			animateTo(base + e.deltaY * unit);
		};
		scroller.addEventListener('wheel', onWheel, { passive: false });
		return () => scroller.removeEventListener('wheel', onWheel);
	}, [animateTo]);

	// The right mouse button does two osu!-stable gestures: *dragging* scrubs the
	// whole list (the cursor's vertical position maps to an absolute scroll
	// fraction), while a *click* - press and release without moving - over a card
	// opens its contextual menu. The press is held back until it travels past a
	// small threshold (commit to scrubbing), so neither gesture disturbs the
	// other; the click path is the app-wide RightClick gesture below, which
	// cancels itself on the same kind of movement. The browser context menu is
	// suppressed globally (Controls), not here.
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const DRAG_PX = 6;
		let pendingY: number | null = null;
		let scrubbing = false;
		const onDown = (e: MouseEvent) => {
			if (e.button !== 2) return;
			e.preventDefault();
			pendingY = e.clientY;
			scrubbing = false;
		};
		const onMove = (e: MouseEvent) => {
			if (pendingY === null && !scrubbing) return;
			if (pendingY !== null && Math.abs(e.clientY - pendingY) < DRAG_PX) return;
			pendingY = null;
			scrubbing = true;
			e.preventDefault();
			scrubTo(e.clientY);
		};
		const onUp = (e: MouseEvent) => {
			if (e.button !== 2) return;
			pendingY = null;
			scrubbing = false;
		};
		scroller.addEventListener('mousedown', onDown);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			scroller.removeEventListener('mousedown', onDown);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	}, [scrubTo]);

	// the right-click commit (mouse right button, or touch long-press): over a
	// card opens its contextual menu, off any card jumps the scroll there
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		return RightClick.on(scroller, (e) => {
			const card = (e.target as HTMLElement | null)
				?.closest?.('.bm-card[data-id]') as HTMLElement | null;

			if (card) {
				const id = Number(card.dataset.id);
				const row = rowsRef.current
					.find((r) => r.type === 'card' && r.item.beatmap.is(id));

				if (row?.type === 'card') onCardRightClick(row.item);
				return;
			}
			scrubTo(e.clientY);
		});
	}, [scrubTo, onCardRightClick]);

	// The single scroll handler: fires for native scrolls (scrollbar, touch, keys)
	// AND for the animation's programmatic scrollTop writes. rAF-throttled; updates
	// the mounted window and the arc together. The *only* path that setStates the
	// window, so the animation loop can never feed back on itself.
	const onScroll = useCallback(() => {
		if (rafRef.current) return;
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = 0;
			syncWindow();
			updateCurve();
		});
	}, [syncWindow, updateCurve]);

	// Re-bow the newly-mounted cards the instant the window changes (before paint),
	// so cards scrolling into view never flash un-curved. Arc only, never setState.
	useLayoutEffect(() => { updateCurve(); }, [range, updateCurve]);

	// On mount / when the library changes / on resize: fit the window, draw the
	// arc, and re-aim the centering glide. The selected-beatmap subscription fires
	// once on mount, which can race ahead of the library loading, so re-center here
	// too once the items are in.
	useLayoutEffect(() => {
		syncWindow();
		updateCurve();
		// center only when the selection itself is new (initial load / re-entry),
		// never on a plain group collapse/expand that just reshapes `rows`.
		const current = music.beatmap.get();
		if (current && lastCenteredRef.current !== current.metadata.id)
			centerOnActive();

		const scroller = scrollRef.current;
		if (!scroller) return;
		const ro = new ResizeObserver(() => { syncWindow(); updateCurve(); });
		ro.observe(scroller);
		return () => ro.disconnect();
	}, [syncWindow, updateCurve, centerOnActive, rows]);

	// Cancel any in-flight animation frames on unmount.
	useEffect(
		() => () => {
			if (animRef.current) cancelAnimationFrame(animRef.current);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			animRef.current = 0;
			rafRef.current = 0;
		},
		[],
	);

	music.beatmap.use(beatmap => {
		if (!beatmap) return;
		centerOnActive();
	});

	const { start, end } = range;
	return (
		<div className="carousel" ref={scrollRef} onScroll={onScroll}>
			<div className="carousel__list">
				{start > 0 && <div 
					className="carousel__spacer" 
					style={{ height: start * STRIDE }} 
				/>}

				{rows.slice(start, end).map(row =>
					row.type === 'header'
						? <GroupHeader
							key={`h:${row.key}`}
							label={row.label}
							count={row.count}
							collapsed={row.collapsed}
							onToggle={() => onToggleGroup(row.key)}
						/>
						: <BeatmapCard
							key={`c:${row.item.beatmap.metadata.id}`}
							beatmap={row.item.beatmap}
							set={row.item.set}
							onCardClick={onCardClick}
							onCardDoubleClick={onCardDoubleClick}
							hasDownloaded={hasDownloaded}
							downloads={downloads}
						/>,
				)}

				{end < rows.length && (
					<div 
						className="carousel__spacer" 
						style={{ height: (rows.length - end) * STRIDE }}
					/>
				)}

				{loading && (
					<div className="carousel__sentinel"><Trans>loading library…</Trans></div>
				)}
				{!loading && rows.length === 0 && (
					<div className="carousel__empty"><Trans>no maps match your search</Trans></div>
				)}
				{!loading && totalCount > 0 && (
					<div 
						className="carousel__end"
					>
						- <Plural
							value={totalCount}
							one="that's all # difficulty"
							other="that's all # difficulties"
						/> -
					</div>
				)}
			</div>
		</div>
	);
}
