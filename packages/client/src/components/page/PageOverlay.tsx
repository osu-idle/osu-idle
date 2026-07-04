import {
	useEffect,
	useState,
} from 'react';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { openPage } from '../../globals';
import Addons from '../../scenes/Addons';
import Skins from '../../scenes/Skins';
import './pageOverlay.css';

/**
 * Hosts the full-screen pages (skins / add-ons) above the active scene, so the
 * scene underneath keeps its state. Stays mounted through the close animation.
 */
export default function PageOverlay() {
	const [state] = useSynced(openPage);
	const [shown, setShown] = useState(state);

	useEffect(() => {
		if (state) setShown(state);
	}, [state]);

	if (!shown) return null;
	const closing = !state;

	return (
		<div
			className={`page-overlay ${closing ? 'is-closing' : 'is-open'}`}
			onAnimationEnd={(e) => {
				if (e.target === e.currentTarget && !openPage.get()) setShown(undefined);
			}}
		>
			{shown.page === 'skins'
				? <Skins key={shown.view} view={shown.view} />
				: <Addons key={shown.view} view={shown.view} />}
		</div>
	);
}
