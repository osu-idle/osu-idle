import { Trans } from '@lingui/react/macro';
import Checkbox from './controls/Checkbox';
import { SETTINGS } from '../../db/settings';

export default function ShowThumbnails() {
	return <Checkbox value={SETTINGS.showThumbnails} label={<Trans>Show thumbnails</Trans>} />;
}
