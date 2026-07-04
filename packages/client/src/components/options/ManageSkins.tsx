import { Trans } from '@lingui/react/macro';
import Button from './controls/Button';
import {
	isOptionsOpen,
	openPage,
} from '../../globals';

const open = () => {
	isOptionsOpen.set(false);
	openPage.set({
		page: 'skins',
		view: 'manage',
	});
};

export default function ManageSkins() {
	return <Button onClick={open} label={<Trans>Manage skins</Trans>} />;
}
