import LeaderboardFilters from '../../components/leaderboard/LeaderboardFilters';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalScoreCountryRankPath, navigate, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function ScoreRankings({ params: { country }}: {
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
					onSelection: (item) => { navigate(item.value === 'All' ? ROUTE.RANKINGS_GLOBAL : globalScoreCountryRankPath(item.value)); },
				}
			]} />
			
			<div className='page-contents'>
				<PlayerLeaderboard sort={'rankedScore'} country={country} />
			</div>
		</main>
	</>);
}
