import Synced from '@osu-idle/shared/helpers/synced';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';
import {
	music,
	PLAYER_MODE,
} from '../../audio/MusicPlayer';

/**
 * Who owns the audio while song select is mounted.
 *
 * As a scene it takes it: the loop plays and selecting a card previews it. As
 * an overlay it takes nothing - whatever is underneath keeps the sound, whether
 * that is a running play or the menu.
 *
 * This deliberately doesn't ask what is playing. Deciding from the outside
 * whether it is safe to start the music is how you end up starting a second
 * song over a play; the rule is the mount, not the state.
 *
 * Returns whether the selection may be previewed, which needs one thing more:
 * that the selection *is* the loaded track. Queueing browses its own, and
 * seeking to its preview offset would jump whatever is actually playing.
 */
export default function useSongSelectAudio(
	overlay: boolean,
	selection: Synced<LightBeatmap | undefined>,
): boolean {
	if (overlay) return false;
	music.mode.set(PLAYER_MODE.LOOP);
	if (!music.playing.get()) music.play(0);
	return selection === music.beatmap;
}
