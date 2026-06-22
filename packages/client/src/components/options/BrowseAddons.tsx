import { Trans } from '@lingui/react/macro';
import Button from './controls/Button';
import { isOptionsOpen } from '../../globals';
import SceneManager, { SCENE } from '../../scenes/SceneManager';

const open = () => {
	isOptionsOpen.set(false);
	SceneManager.set(SCENE.ADDONS, 'browse');
};

export default function BrowseAddons() {
	return <Button onClick={open} label={<Trans>Browse add-ons</Trans>} />;
}
