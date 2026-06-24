import {
	useEffect,
	useRef,
	useState,
} from 'react';

export interface Parallax {
	/** -1 .. 1, where 0 is centred */
	x: number
	y: number
}

/**
 * Tracks the pointer position as a normalised (-1..1) offset from the screen
 * centre, smoothed toward the target each frame so movement feels weighty -
 * the same easing osu! uses for its parallax menu background.
 */
export function useParallax(smoothing = 0.08, enabled = true): Parallax {
	const [value, setValue] = useState<Parallax>({
		x: 0, y: 0, 
	});
	const target = useRef<Parallax>({
		x: 0, y: 0, 
	});
	const currentRef = useRef<Parallax>({
		x: 0, y: 0, 
	});

	useEffect(() => {
		// Disabled (player turned parallax off): snap to centre and run nothing.
		if (!enabled) {
			target.current = {
				x: 0, y: 0, 
			};
			currentRef.current = {
				x: 0, y: 0, 
			};
			setValue({
				x: 0, y: 0, 
			});
			return;
		}

		const onMove = (e: PointerEvent) => {
			target.current = {
				x: (e.clientX / window.innerWidth) * 2 - 1,
				y: (e.clientY / window.innerHeight) * 2 - 1,
			};
		};
		window.addEventListener('pointermove', onMove);

		let raf = 0;
		const tick = () => {
			const cur = currentRef.current;
			const next = {
				x: cur.x + (target.current.x - cur.x) * smoothing,
				y: cur.y + (target.current.y - cur.y) * smoothing,
			};
			currentRef.current = next;
			// only re-render on meaningful movement to avoid churn
			if (Math.abs(next.x - cur.x) > 0.0002 || Math.abs(next.y - cur.y) > 0.0002) {
				setValue(next);
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			window.removeEventListener('pointermove', onMove);
			cancelAnimationFrame(raf);
		};
	}, [smoothing, enabled]);

	return value;
}
