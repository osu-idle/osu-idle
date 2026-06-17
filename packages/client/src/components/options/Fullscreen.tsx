import { Trans } from '@lingui/react/macro';
import Checkbox from './controls/Checkbox';
import { SETTINGS } from '../../db/settings';
import { applyFullscreen } from '../../responsive/fullscreen';

export default function Fullscreen() {
	return (
		<Checkbox
			value={SETTINGS.fullscreen}
			label={<Trans>Fullscreen mode</Trans>}
			onChange={applyFullscreen}
		/>
	);
}
