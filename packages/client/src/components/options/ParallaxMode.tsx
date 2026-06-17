import { Trans } from '@lingui/react/macro';
import Checkbox from './controls/Checkbox';
import { SETTINGS } from '../../db/settings';

export default function ParallaxMode() {
	return <Checkbox value={SETTINGS.parallax} label={<Trans>Parallax</Trans>} />;
}
