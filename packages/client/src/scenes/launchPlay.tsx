import LightBeatmap from '../osu/beatmap/LightBeatmap';
import SceneManager, { SCENE } from './SceneManager';
import {
	LoadingPanel,
	Transition,
} from './Transition';

// guards against launching the same play twice (a double click, or a queue
// advance racing a manual launch): a ranked map would mint two server-side
// tokens but only one gets validated, costing the player the play.
//
// It is time-bounded on purpose. It used to be cleared only when the cover
// finished rising; anything that stopped that promise resolving left the guard
// stuck, and from then on every launch - including the queue's - was silently a
// no-op. A stuck guard must not be able to end the idle loop.
let launching = 0;
const LAUNCH_GUARD_MS = 5000;

/**
 * Launch gameplay for a downloaded difficulty. Raises the transition cover with
 * a loading panel, then hands off to the gameplay scene, which loads the beatmap
 * and resolves the play session *behind* the cover
 */
export function launchPlay(beatmap: LightBeatmap, debug = false): boolean {
	if (Date.now() - launching < LAUNCH_GUARD_MS) return false;
	launching = Date.now();
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
		launching = 0;
	});
	return true;
}
