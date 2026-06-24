import '../components/skins/skins.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import Controls from '../input/Controls';
import SceneManager, { SCENE } from './SceneManager';
import Page from '../components/page/Page';
import ManageSkinsView from '../components/skins/ManageSkinsView';
import BrowseSkinsView from '../components/skins/BrowseSkinsView';

export type SkinsView = 'manage' | 'browse';

/** The add-ons scene: manage installed / authored add-ons, or browse the catalog. */
export default function Skins({ view: initial }: { view: SkinsView }) {
	const { t } = useLingui();

	const back = () => SceneManager.set(SCENE.MENU);
	Controls.back.usePress(back);

	return (
		<Page
			title={<Trans>Skins</Trans>}
			onBack={back}
			backLabel={<Trans>Back to Menu</Trans>}
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
