import { Trans } from '@lingui/react/macro';
import Checkbox from './controls/Checkbox';
import { SETTINGS } from '../../db/settings';

export default function OsuMusicTheme() {
	return <Checkbox value={SETTINGS.osuMusicTheme} label={
		<Trans>osu! music theme</Trans>
	} />;
}
