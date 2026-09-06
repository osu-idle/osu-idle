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
					subtitle: t`Reset a skill for a permanent level bonus`,
					render: () => <PrestigeView />,
				},
				{
					id: 'rebirth',
					label: <Trans>Rebirth</Trans>,
					subtitle: t`Start over with a new character that unlocks new features`,
					render: () => <RebirthView />,
				},
			]}
		/>
	);
}
