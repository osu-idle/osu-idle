import {
	useEffect,
	useState,
} from 'react';

/** Re-render on an interval, for the clock-driven bits (progress, countdown)
 *  that no state change would otherwise move. */
export default function useTick(active: boolean, ms = 1000): void {
	const [, setTick] = useState(0);
	useEffect(() => {
		if (!active) return;
		const timer = window.setInterval(() => setTick(n => n + 1), ms);
		return () => window.clearInterval(timer);
	}, [active, ms]);
}
