import { Trans } from '@lingui/react/macro';
import Slider from './controls/Slider';
import { SETTINGS } from '../../db/settings';

export default function MasterVolume() {
	return <Slider value={SETTINGS.mainVolume} label={<Trans>Master</Trans>} />;
}
