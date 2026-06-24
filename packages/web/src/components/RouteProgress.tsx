import './RouteProgress.css';
import {
	useEffect,
	useState,
} from 'react';
import { useRouterState } from '@tanstack/react-router';

/** Thin full-width bar at the very top of the page, shown only while a route
 *  navigation is pending. The previous page stays visible until the next route's
 *  loader resolves, so this is the only thing that moves during a load. */
export default function RouteProgress() {
	const pending = useRouterState({ select: s => s.status === 'pending' });
	const [progress, setProgress] = useState(0);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (pending) {
			setVisible(true);
			setProgress(10);
			// Trickle towards 90% so the bar keeps creeping while the loader runs.
			const id = setInterval(() => setProgress(p => Math.min(p + (90 - p) * 0.12, 90)), 200);
			return () => clearInterval(id);
		}

		// Settle to 100% then fade out.
		setProgress(100);
		const id = setTimeout(() => { setVisible(false); setProgress(0); }, 300);
		return () => clearTimeout(id);
	}, [pending]);

	if (!visible) return null;

	return <div
		className='route-progress'
		data-done={progress >= 100} 
		style={{ width: `${progress}%` }} 
	/>;
}
