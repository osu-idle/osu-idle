import LightBeatmap from '../osu/beatmap/LightBeatmap';
import SceneManager, { SCENE } from './SceneManager';
import {
	LoadingPanel,
	Transition,
} from './Transition';

// guards against launching the same play twice (a double click, or an autopilot
// advance racing a manual launch): a ranked map would mint two server-side
// tokens but only one gets validated, costing the player the play.
let launching = false;

/**
 * Launch gameplay for a downloaded difficulty. Raises the transition cover with
 * a loading panel, then hands off to the gameplay scene, which loads the beatmap
 * and resolves the play session *behind* the cover
 */
export function launchPlay(beatmap: LightBeatmap, debug = false): void {
	if (launching) return;
	launching = true;
	const transition = Transition.begin(
		<LoadingPanel 
			title={`${beatmap.set.metadata.artist} - ${beatmap.set.metadata.title}`} 
			sub={beatmap.metadata.version} 
		/>,
	);
	// swap to gameplay only once the cover is fully opaque - otherwise the scene
	// change shows through the still-transparent fade-in. The outgoing scene stays
	// up (behind the rising cover) until then; the cover persists past its unmount.
	void transition.covered.then(() => {
		SceneManager.set(SCENE.GAME, beatmap, transition, debug);
		launching = false;
	});
}
