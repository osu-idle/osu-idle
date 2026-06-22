import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalScoreCountryRankPath, globalScoreRankPath, navigate } from '../../router';
import RankingsNav from './RankingsNav';

export default function ScoreRankings({ params: { country, page }}: {
	params: { country?: string, page?: number }
}) {
	page = page ?? 1;
	return (<>
		<main>
			<RankingsNav current={'score'} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? globalScoreCountryRankPath(value, 1) : globalScoreRankPath(1))} />
			
			<div className='page-contents'>
				<PlayerLeaderboard sort={'rankedScore'} country={country} page={page} />
			</div>
		</main>
	</>);
}
