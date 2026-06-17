import { Trans } from '@lingui/react/macro';
import Slider from './controls/Slider';
import { SETTINGS } from '../../db/settings';

export default function AutopilotDelay() {
	return (
		<Slider
			value={SETTINGS.autopilotDelay}
			label={<Trans>Autopilot delay</Trans>}
			min={3}
			max={120}
			step={1}
			format={(n) => `${n}s`}
		/>
	);
}
