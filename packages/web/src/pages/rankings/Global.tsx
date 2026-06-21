import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import { globalCountryRankPath, navigate, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function GlobalRankings({ params: { country }}: {
	params: { country?: string }
}) {
	return (<>
		<main>
			<RankingsNav current={ROUTE.RANKINGS_GLOBAL} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? globalCountryRankPath(value) : ROUTE.RANKINGS_GLOBAL)} />

			<div className='page-contents'>
				<PlayerLeaderboard sort={'pp'} country={country} />
			</div>
		</main>
	</>);
}
