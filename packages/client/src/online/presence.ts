import { t } from '@lingui/core/macro';
import Synced from '@osu-idle/shared/helpers/synced';
import { desktop } from '@osu-idle/shared/desktop';
import SceneManager, {
	SCENE,
	type Scene,
} from '../scenes/SceneManager';
import { music } from '../audio/MusicPlayer';
import type LightBeatmap from '../osu/beatmap/LightBeatmap';
import { ScoreDTO } from '@osu-idle/shared/score';
import { Score } from '../db/schema/score';
import { currentScore } from '../globals';
import num from '@osu-idle/shared/display/num';

/**
 * Drives the desktop app's Discord Rich Presence from the live scene and the
 * playing map. Inert in the browser, so it's safe to start
 * unconditionally. To add a scene, give it a label in {@link sceneLabel} - the
 * Discord-specific plumbing lives in the desktop package and never changes here.
 */
export default class Presence {

	private static startedAt = Date.now();
	// private static lastKey = '';

	public static start(): void {
		if (!desktop()) return;
		void Synced.all([
			SceneManager.current, 
			music.beatmap,
			currentScore,
		], ([scene, beatmap, score]) => this.update(scene, beatmap, score));
	}

	private static update(
		scene: Scene,
		beatmap?: LightBeatmap,
		score?: Score | ScoreDTO,
	): void {
		const bridge = desktop();
		if (!bridge) return;

		if (scene === SCENE.GAME && beatmap) {
			const map = `${beatmap.set.metadata.artist} - ${beatmap.set.metadata.title} [${beatmap.metadata.version}]`;
			
			bridge.setPresence({
				details: t`Playing`,
				state: map,
				startedAt: this.startedAt,
			});
		} else if (scene === SCENE.RESULT && beatmap && score) {
			const result = num(score.score);
			const map = `${beatmap.set.metadata.artist} - ${beatmap.set.metadata.title} [${beatmap.metadata.version}]`;
			
			bridge.setPresence({
				details: t`Viewing results`,
				state: t`${result} on ${map}`,
				startedAt: this.startedAt,
				smallImage: `grade-${score.grade.toLowerCase()}`,
			});
		} else {
			bridge.setPresence({
				details: this.sceneLabel(scene), 
				startedAt: this.startedAt, 
			});
		}
	}

	private static sceneLabel(scene: Scene): string {
		switch (scene) {
			case SCENE.SELECT: return t`Selecting a song`;
			case SCENE.RESULT: return t`Viewing results`;
			default: return t`In the menus`;
		}
	}

}
