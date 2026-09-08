import {
	useEffect,
	useState,
} from 'react';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { openPage } from '../../globals';
import SceneManager, { SCENE } from '../../scenes/SceneManager';
import Addons from '../../scenes/Addons';
import Skins from '../../scenes/Skins';
import Character from '../../scenes/Character';
import SongSelect from '../../scenes/SongSelect';
import './pageOverlay.css';

/**
 * Hosts the full-screen pages (skins / add-ons / character / the play queue)
 * above the active scene, so the scene underneath keeps its state - including a
 * play that is running. Stays mounted through the close animation.
 */
export default function PageOverlay() {
	const [state] = useSynced(openPage);
	const [scene] = useSynced(SceneManager.current);
	const [shown, setShown] = useState(state);

	useEffect(() => {
		if (state) setShown(state);
	}, [state]);

	// song select flips into queue mode in place rather than stacking a second
	// carousel over the one already on screen. Nothing is rendered, so nothing
	// will animate out either - drop it now, or closing the page leaves it held
	// and the next scene mounts a whole carousel for the fade.
	const inPlace = shown?.page === 'queue' && scene === SCENE.SELECT;
	useEffect(() => {
		if (inPlace && !state) setShown(undefined);
	}, [inPlace, state]);

	if (!shown || inPlace) return null;
	const closing = !state;

	return (
		<div
			className={[
				'page-overlay',
				closing ? 'is-closing' : 'is-open',
				// over a running play, the page thins out so the playfield behind it
				// is still readable - you are managing a character that is playing
				scene === SCENE.GAME ? 'is-over-play' : '',
			].join(' ')}
			onAnimationEnd={(e) => {
				if (e.target === e.currentTarget && !openPage.get()) setShown(undefined);
			}}
		>
			{shown.page === 'character'
				? <Character />
				: shown.page === 'queue'
					? <SongSelect mode="queue" />
					: shown.page === 'skins'
						? <Skins key={shown.view} view={shown.view} />
						: <Addons key={shown.view} view={shown.view} />}
		</div>
	);
}
