import './CommunityBody.css';
import { useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Account from '../../online/account';
import Socket from '../../online/socket';
import {
	TAB,
	type Tab,
	sortCharacters,
} from './tabs';
import {
	activeFilter,
	activeTab,
	searchQuery,
} from './state';
import Tabs, { type Tab as TabItem } from '../tabs/Tabs';
import PlayerGrid from './PlayerGrid';
import WorldMap from './WorldMap';

/** The tab bar + the roster body (player grid or world map). */
export default function CommunityBody() {
	const { t } = useLingui();
	const [characters = []] = useSynced(Socket.presence);
	const [tab = TAB.name] = useSynced(activeTab);
	const [filter = 'all'] = useSynced(activeFilter);
	const [search = ''] = useSynced(searchQuery);
	const [account] = useSynced(Account.character);

	const query = search.trim().toLowerCase();
	const filtered = characters.filter(c => {
		if (filter === 'country' && account?.country && c.country !== account.country) return false;
		if (filter === 'friends') return false;
		return !query || c.name.toLowerCase().includes(query);
	});

	const sortTabs = [
		{
			id: TAB.name, label: t`Name`,
		},
		{
			id: TAB.rank, label: t`Rank`,
		},
		{
			id: TAB.location, label: t`Location`,
		},
		{
			id: TAB.timezone, label: t`Time Zone`,
		},
	];

	const tabs: TabItem<Tab>[] = [
		...sortTabs.map(tb => ({
			...tb,
			className: 'special',
			render: () => <PlayerGrid characters={sortCharacters(filtered, tb.id)} />,
		} satisfies TabItem<Tab>)),
		{
			id: TAB.map,
			className: 'special',
			label: t`World Map`,
			render: () => <WorldMap characters={filtered} />,
		},
	];

	return (
		<div className="community-body">
			<Tabs tabs={tabs} active={activeTab} />

			{filter === 'friends'
				? <div className="community-empty">{t`Friends are coming soon`}</div>
				: tabs.find(tb => tb.id === tab)?.render()}
		</div>
	);
}
