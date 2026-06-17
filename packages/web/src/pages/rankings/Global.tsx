import LeaderboardFilters from '../../components/leaderboard/LeaderboardFilters';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalCountryRankPath, navigate, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function GlobalRankings({ params: { country }}: {
	params: { country?: string }
}) {
	return (<>
		<main>
			<RankingsNav current={ROUTE.RANKINGS_GLOBAL} />
			<LeaderboardFilters filters={[
				{
					label: 'country',
					type: 'select',
					items: [
						{
							label: 'All',
							value: 'All',
						},
						{
							label: 'France',
							value: 'FR',
						},
						{
							label: 'Guyane Française',
							value: 'GF',
						},
					],
					selected: country ?? 'All',
					onSelection: (item) => { navigate(item.value === 'All' ? ROUTE.RANKINGS_GLOBAL : globalCountryRankPath(item.value)); },
				}
			]} />

			<div className='page-contents'>
				<PlayerLeaderboard sort={'pp'} country={country} />
			</div>
		</main>
	</>);
}
