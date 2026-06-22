import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalCountryRankPath, navigate, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function GlobalRankings({ params: { country, page }}: {
	params: { country?: string, page?: number }
}) {
	page = page ?? 1;
	return (<>
		<main>
			<RankingsNav current={'global'} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? globalCountryRankPath(value, page) : ROUTE.RANKINGS_GLOBAL)} />

			<div className='page-contents'>
				<PlayerLeaderboard sort={'pp'} country={country} page={page} />
			</div>
		</main>
	</>);
}
