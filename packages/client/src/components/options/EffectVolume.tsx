import { Trans } from '@lingui/react/macro';
import Slider from './controls/Slider';
import { SETTINGS } from '../../db/settings';

export default function EffectVolume() {
	return <Slider value={SETTINGS.effectVolume} label={<Trans>Effect</Trans>} />;
}
