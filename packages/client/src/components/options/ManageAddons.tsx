import { Trans } from '@lingui/react/macro';
import Button from './controls/Button';
import {
	isOptionsOpen,
	openPage,
} from '../../globals';

const open = () => {
	isOptionsOpen.set(false);
	openPage.set({
		page: 'addons',
		view: 'manage',
	});
};

export default function ManageAddons() {
	return <Button onClick={open} label={<Trans>Manage add-ons</Trans>} />;
}
