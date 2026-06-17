import { Trans } from '@lingui/react/macro';
import { SETTINGS } from '../../db/settings';
import Dropdown from '../dropdown/Dropdown';
import { autopilotModeLabels, AutopilotModes } from '../../gameplay/autopilot';

export default function AutopilotMode() {
	const labels = autopilotModeLabels();
	const options = AutopilotModes.map(mode => ({
		value: mode,
		label: labels[mode],
	}));
	return (
		<div className="opt-row">
			<span className="opt-row__label"><Trans>Autopilot mode</Trans></span>
			<Dropdown value={SETTINGS.autopilotMode} options={options} />
		</div>
	);
}
