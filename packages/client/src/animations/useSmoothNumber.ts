import {
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	SmoothNumber,
	SmoothNumberOptions,
} from './smoothNumber';

export type UseSmoothNumberOptions = SmoothNumberOptions & {
	/** value to start from on mount, so the first render glides `from` → `target`
	 *  (e.g. count up from 0). Defaults to `target` (no initial animation). */
	from?: number;
};

/**
 * React binding for SmoothNumber pass the target value and get back the
 * eased value, re-rendering each frame only while it's catching up. Whenever
 * `target` changes the displayed value glides toward it from where it was.
 *
 *   const shown = useSmoothNumber(score, { duration: 400 });
 *   const shown = useSmoothNumber(score, { duration: 3000, from: 0 });
 */
export default function useSmoothNumber(
	target: number, 
	options?: UseSmoothNumberOptions,
): number {
	const ref = useRef<SmoothNumber | undefined>(undefined);
	if (!ref.current) 
		ref.current = new SmoothNumber(options?.from ?? target, options);
	const smooth = ref.current;

	const [value, setValue] = useState(options?.from ?? target);

	useEffect(() => {
		smooth.set(target, options?.duration);
		let raf = 0;
		const tick = () => {
			setValue(smooth.value);
			if (!smooth.done) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [target, options?.duration]);

	return value;
}
