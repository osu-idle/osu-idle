import '../components/upgrades/upgrades.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { openPage } from '../globals';
import Page from '../components/page/Page';
import UpgradesView from '../components/upgrades/UpgradesView';

/** The upgrades page: spend skill levels on permanent XP-gain boosts. */
export default function Upgrades() {
	const { t } = useLingui();

	return (
		<Page
			title={<Trans>Upgrades</Trans>}
			subtitle={t`Trade skill levels for permanent XP boosts`}
			onBack={() => openPage.set(undefined)}
		>
			<UpgradesView />
		</Page>
	);
}
