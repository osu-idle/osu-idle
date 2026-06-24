import '../components/addons/addons.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import Controls from '../input/Controls';
import SceneManager, { SCENE } from './SceneManager';
import Page from '../components/page/Page';
import ManageAddonsView from '../components/addons/ManageAddonsView';
import BrowseAddonsView from '../components/addons/BrowseAddonsView';

export type AddonsView = 'manage' | 'browse';

/** The add-ons scene: manage installed / authored add-ons, or browse the catalog. */
export default function Addons({ view: initial }: { view: AddonsView }) {
	const { t } = useLingui();

	const back = () => SceneManager.set(SCENE.MENU);
	Controls.back.usePress(back);

	return (
		<Page
			title={<Trans>Add-ons</Trans>}
			onBack={back}
			backLabel={<Trans>Back to Menu</Trans>}
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
