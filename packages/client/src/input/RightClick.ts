import {
	RefObject,
	useEffect,
	useRef,
} from 'react';
import { SETTINGS } from '../db/settings';

export interface RightClickEvent {
	clientX: number;
	clientY: number;
	/** the element under the initial press (not the release) */
	target: EventTarget | null;
	/** true when triggered by a touch long-press rather than a mouse button */
	longPress: boolean;
}

type RightClickCallback = (e: RightClickEvent) => void;

/**
 * The app-wide "right click" gesture, one event for every pointer type:
 * desktop fires on a right-button press released without moving, touch fires
 * when a still press outlasts the long-press delay (the `longpress` setting).
 * Hook on this instead of `button === 2` so touch support is never a special
 * case at the call site. The native browser context menu is already suppressed
 * globally (Controls), including the one Android raises on long-press.
 */
export default class RightClick {

	/** movement (px) beyond which the press is a drag/scroll, not a click */
	private static readonly MOVE_PX = 6;

	// a long-press fires while the finger is still down, so the tap's own click
	// (dispatched on release) must be swallowed or the element underneath would
	// also activate - e.g. selecting the card whose menu just opened. The flag
	// only ever swallows the very next click: any new press clears it first.
	private static suppressClick = false;

	private static initialized = false;
	private static init() {
		if (this.initialized) return;
		this.initialized = true;
		window.addEventListener('pointerdown', () => { 
			this.suppressClick = false; 
		}, { capture: true });
		window.addEventListener('click', (e) => {
			if (!this.suppressClick) return;
			this.suppressClick = false;
			e.preventDefault();
			e.stopPropagation();
		}, { capture: true });
	}

	/** Listen for right clicks on `el`; returns the unsubscribe. */
	public static on(el: HTMLElement, callback: RightClickCallback): () => void {
		this.init();

		let pending: { 
			id: number,
			x: number, 
			y: number, 
			target: EventTarget | null 
		} | null = null;
		let timer = 0;

		const cancel = () => {
			pending = null;
			if (timer) {
				clearTimeout(timer);
				timer = 0;
			}
		};

		const fire = (longPress: boolean) => {
			if (!pending) return;
			const { x, y, target } = pending;
			cancel();
			callback({
				clientX: x, clientY: y, target, longPress, 
			});
		};

		const onDown = (e: PointerEvent) => {
			// any new pointer invalidates a pending gesture (a second finger
			// means a pinch/multi-touch, not a long-press)
			cancel();
			if (e.pointerType === 'mouse') {
				if (e.button !== 2) return;
				pending = {
					id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target, 
				};
			} else if (e.isPrimary) {
				pending = {
					id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target, 
				};
				timer = window.setTimeout(() => {
					timer = 0;
					RightClick.suppressClick = true;
					fire(true);
				}, SETTINGS.longpress.get());
			}
		};

		const onMove = (e: PointerEvent) => {
			if (!pending || e.pointerId !== pending.id) return;
			const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
			if (dist >= RightClick.MOVE_PX) 
				cancel();
		};

		const onUp = (e: PointerEvent) => {
			if (!pending || e.pointerId !== pending.id) return;
			// mouse commits on release; a touch released here never reached the
			// long-press delay, so it was a plain tap
			if (e.pointerType === 'mouse') fire(false);
			else cancel();
		};

		el.addEventListener('pointerdown', onDown);
		// move/up on window: the pointer may leave the element mid-press
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', cancel);
		return () => {
			cancel();
			el.removeEventListener('pointerdown', onDown);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', cancel);
		};
	}

	/** React hook variant of {@link on}: see {@link Listener.use}. */
	public static use(
		ref: RefObject<HTMLElement | null>, 
		callback: RightClickCallback,
	): void {
		const cb = useRef(callback);
		cb.current = callback;
		useEffect(() => {
			const el = ref.current;
			if (!el) return;
			return RightClick.on(el, (e) => cb.current(e));
		}, [ref]);
	}

}
