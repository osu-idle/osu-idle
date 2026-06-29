import { useState } from 'react';
import Synced from '../helpers/synced.js';
import useSynced from './useSynced.js';

export default function useSync<T>(initial: T): [Synced<T>, T, T | undefined];
export default function useSync<T>(): [Synced<T | undefined>, T | undefined, T | undefined];
export default function useSync<T>(initial?: T) {
	const [synced] = useState(() => new Synced(initial));
	const [value, previous] = useSynced(synced);
	return [synced, value, previous];
}
