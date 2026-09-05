import '../components/upgrades/upgrades.css';
import '../components/character/character.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { openPage } from '../globals';
import Page from '../components/page/Page';
import UpgradesView from '../components/upgrades/UpgradesView';
import PrestigeView from '../components/character/PrestigeView';
import RebirthView from '../components/character/RebirthView';

/** The character page: the three progression loops, one per tab. */
export default function Character() {
	const { t } = useLingui();

	return (
		<Page
			title={<Trans>Character</Trans>}
			onBack={() => openPage.set(undefined)}
			tabs={[
				{
					id: 'upgrades',
					label: <Trans>Upgrades</Trans>,
					subtitle: t`Trade skill levels for permanent XP boosts`,
					render: () => <UpgradesView />,
				},
				{
					id: 'prestige',
					label: <Trans>Prestige</Trans>,
					subtitle: t`Reset a maxed skill for permanent bonus levels`,
					render: () => <PrestigeView />,
				},
				{
					id: 'rebirth',
					label: <Trans>Rebirth</Trans>,
					subtitle: t`Start a new character that is born with more unlocks`,
					render: () => <RebirthView />,
				},
			]}
		/>
	);
}
