import '../components/skins/skins.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { openPage } from '../globals';
import Page from '../components/page/Page';
import ManageSkinsView from '../components/skins/ManageSkinsView';
import BrowseSkinsView from '../components/skins/BrowseSkinsView';

export type SkinsView = 'manage' | 'browse';

/** The skins page: manage installed / authored skins, or browse the catalog. */
export default function Skins({ view: initial }: { view: SkinsView }) {
	const { t } = useLingui();

	const back = () => openPage.set(undefined);

	return (
		<Page
			title={<Trans>Skins</Trans>}
			onBack={back}
			initialTab={initial}
			tabs={[
				{
					id: 'manage',
					label: <Trans>Manage</Trans>,
					subtitle: t`Manage your installed and created skins`,
					render: () => <ManageSkinsView />,
				},
				{
					id: 'browse',
					label: <Trans>Browse</Trans>,
					subtitle: t`Browse the community catalogue`,
					render: () => <BrowseSkinsView />,
				},
			]}
		/>
	);
}
