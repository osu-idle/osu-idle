import { Trans } from '@lingui/react/macro';
import Button from './controls/Button';
import { isOptionsOpen } from '../../globals';
import SceneManager, { SCENE } from '../../scenes/SceneManager';

const open = () => {
	isOptionsOpen.set(false);
	SceneManager.set(SCENE.SKINS, 'manage');
};

export default function ManageSkins() {
	return <Button onClick={open} label={<Trans>Manage skins</Trans>} />;
}
