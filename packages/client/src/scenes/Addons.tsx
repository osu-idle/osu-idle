import '../components/addons/addons.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { openPage } from '../globals';
import Page from '../components/page/Page';
import ManageAddonsView from '../components/addons/ManageAddonsView';
import BrowseAddonsView from '../components/addons/BrowseAddonsView';

export type AddonsView = 'manage' | 'browse';

/** The add-ons page: manage installed / authored add-ons, or browse the catalog. */
export default function Addons({ view: initial }: { view: AddonsView }) {
	const { t } = useLingui();

	const back = () => openPage.set(undefined);

	return (
		<Page
			title={<Trans>Add-ons</Trans>}
			onBack={back}
			initialTab={initial}
			tabs={[
				{
					id: 'manage',
					label: <Trans>Manage</Trans>,
					subtitle: t`Manage your installed and created add-ons`,
					render: () => <ManageAddonsView />,
				},
				{
					id: 'browse',
					label: <Trans>Browse</Trans>,
					subtitle: t`Browse the community catalogue`,
					render: () => <BrowseAddonsView />,
				},
			]}
		/>
	);
}
