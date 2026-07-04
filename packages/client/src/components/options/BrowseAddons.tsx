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
		view: 'browse',
	});
};

export default function BrowseAddons() {
	return <Button onClick={open} label={<Trans>Browse add-ons</Trans>} />;
}
