import {
	useEffect,
	useState,
} from 'react';

/**
 * Whether shift is currently held. Tracks the key rather than reading it off a
 * click, so the UI can show what a click is about to do before it happens.
 * Resets when the window loses focus, where the keyup never arrives.
 */
export default function useShiftHeld(): boolean {
	const [held, setHeld] = useState(false);

	useEffect(() => {
		const set = (e: KeyboardEvent) => setHeld(e.shiftKey);
		const clear = () => setHeld(false);
		window.addEventListener('keydown', set);
		window.addEventListener('keyup', set);
		window.addEventListener('blur', clear);
		return () => {
			window.removeEventListener('keydown', set);
			window.removeEventListener('keyup', set);
			window.removeEventListener('blur', clear);
		};
	}, []);

	return held;
}
