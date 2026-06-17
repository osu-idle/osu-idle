import { useState, useEffect } from 'react';
import Synced from '../helpers/synced.js'; 

export default function useSynced<T>(synced: Synced<T>): [T, T | undefined] {
	const [state, setState] = useState<{ current: T; previous?: T }>({
		current: synced.get(),
		previous: undefined, 
	});

	useEffect(() => {
		let isMounted = true;

		const handleUpdate = (current: T, previous?: T) => {
			if (isMounted) {
				setState({ current, previous });
			}
		};

		synced?.sync(handleUpdate);

		return () => {
			isMounted = false;
			synced?.desync(handleUpdate);
		};
	}, [synced]);

	return [state.current, state.previous];
}