import { Trans } from '@lingui/react/macro';
import Checkbox from './controls/Checkbox';
import { SETTINGS } from '../../db/settings';

export default function ShowFPS() {
	return <Checkbox value={SETTINGS.showFps} label={<Trans>Show FPS counter</Trans>} />;
}
