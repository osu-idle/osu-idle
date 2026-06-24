import {
	useEffect,
	useState,
} from 'react';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { SETTINGS } from '../db/settings';
import './FpsCounter.css';

/**
 * Tiny corner FPS read-out, gated on the `showFps` setting. Samples twice a
 * second so it's readable, and runs no rAF loop at all while hidden.
 */
export default function FpsCounter() {
	const [show] = useSynced(SETTINGS.showFps);
	const [fps, setFps] = useState(0);

	useEffect(() => {
		if (!show) return;
		let raf = 0;
		let frames = 0;
		let last = performance.now();
		const tick = (now: number) => {
			frames++;
			if (now - last >= 500) {
				setFps(Math.round((frames * 1000) / (now - last)));
				frames = 0;
				last = now;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [show]);

	if (!show) return null;
	return <div className="fps-counter">{fps} FPS</div>;
}
