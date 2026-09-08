import { useLingui } from '@lingui/react/macro';
import LightBeatmap from '../../osu/beatmap/LightBeatmap';
import StrainDebug from '../../scenes/StrainDebug';
import XpMultiplierToggle from './XpMultiplierToggle';

type Props = {
	/** dev build only: everything here is hidden in production */
	enabled: boolean;
	onOpen: () => void;
	/** the difficulty the strain view is open on, if any */
	beatmap?: LightBeatmap;
	onClose: () => void;
	onPlay: (beatmap: LightBeatmap) => void;
};

/** The dev-only corner of song select: the strain view, its trigger, and the XP
 *  multiplier. Grouped so the scene itself carries none of it. */
export default function SongSelectDebug({
	enabled, onOpen, beatmap, onClose, onPlay,
}: Props) {
	const { t } = useLingui();
	if (!enabled) return null;

	return (<>
		<button className="game__debug-btn" onClick={onOpen} title={t`Strain debug`}>
			⛛
		</button>
		<XpMultiplierToggle />
		{beatmap && (
			<StrainDebug
				beatmapInfo={beatmap}
				onClose={onClose}
				onPlay={() => onPlay(beatmap)}
			/>
		)}
	</>);
}
