import { Trans } from '@lingui/react/macro';
import Slider from './controls/Slider';
import { SETTINGS } from '../../db/settings';

export default function BackgroundDim() {
	return (
		<Slider
			value={SETTINGS.backgroundDim}
			label={<Trans>Background dim</Trans>}
			min={0}
			max={1}
			step={0.01}
		/>
	);
}
