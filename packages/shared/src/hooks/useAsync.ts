import { useEffect, useState, type DependencyList } from 'react';

/**
 * Derives a value from an async computation, re-running whenever `deps` change.
 * Stale results are dropped on change/unmount, so rapid dependency changes can't
 * land an out-of-order update. Returns `undefined` until the first result lands.
 */
export default function useAsync<T>(
	factory: () => Promise<T> | T,
	deps: DependencyList,
): T | undefined {
	const [value, setValue] = useState<T>();

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const result = await factory();
			if (!cancelled) setValue(result);
		})();
		return () => { cancelled = true; };
	}, deps);

	return value;
}
