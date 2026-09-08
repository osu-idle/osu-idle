import { useParallax } from '@osu-idle/shared/hooks/useParallax';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { music } from '../audio/MusicPlayer';
import { SETTINGS } from '../db/settings';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import './Background.css';

/** The live track's backdrop, or a given map's - a screen about one particular
 *  map (a result) says which, instead of following whatever is selected. */
export default function Background({ beatmap }: { beatmap?: LightBeatmap }) {
	const [parallaxOn] = useSynced(SETTINGS.parallax);
	const parallax = useParallax(0.08, parallaxOn);
	
	const live = music.beatmap.use(async (map, previous) => {
		return map?.getBackgroundUri() ?? previous?.getBackgroundUri();
	});
	const own = useAsync(async () => beatmap?.getBackgroundUri(), [beatmap]);
	const background = beatmap ? own : live;

	return (
		<div
			className="background__image"
			style={{
				backgroundImage: background ? `url("${background}")` : '',
				transform: `scale(1.1) translate(${parallax.x * 26}px, ${parallax.y * 26}px)`,
			}}
		/>
	);
};