import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalScoreCountryRankPath, navigate, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function ScoreRankings({ params: { country }}: {
	params: { country?: string }
}) {
	return (<>
		<main>
			<RankingsNav current={ROUTE.RANKINGS_GLOBAL} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? globalScoreCountryRankPath(value) : ROUTE.RANKINGS_GLOBAL)} />
			
			<div className='page-contents'>
				<PlayerLeaderboard sort={'rankedScore'} country={country} />
			</div>
		</main>
	</>);
}
