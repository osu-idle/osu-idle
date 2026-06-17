import { useParallax } from '@osu-idle/shared/hooks/useParallax';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { music } from '../audio/MusicPlayer';
import { SETTINGS } from '../db/settings';
import './Background.css';

export default function Background({}) {
	const [parallaxOn] = useSynced(SETTINGS.parallax);
	const parallax = useParallax(0.08, parallaxOn);
	
	const background = music.beatmap.use(async (beatmap, previous) => {
		return beatmap?.getBackgroundUri() ?? previous?.getBackgroundUri();
	});

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