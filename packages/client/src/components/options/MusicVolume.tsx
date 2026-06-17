import { Trans } from '@lingui/react/macro';
import Slider from './controls/Slider';
import { SETTINGS } from '../../db/settings';

export default function MusicVolume() {
	return <Slider value={SETTINGS.musicVolume} label={<Trans>Music</Trans>} />;
}
