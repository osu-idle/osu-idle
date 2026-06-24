import { useNavigate } from '@tanstack/react-router';
import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerLeaderboard from '../../components/leaderboard/PlayerLeaderboard';
import type { getGlobalRanking } from '../../api/rankings';
import RankingsNav from './RankingsNav';

type Players = Awaited<ReturnType<typeof getGlobalRanking>>;

export default function GlobalRankings({ page, country, players }: {
	page: number,
	country?: string,
	players: Players,
}) {
	const navigate = useNavigate();
	return (
		<main>
			<RankingsNav current={'global'} />
			<CountryFilter selected={country} onSelect={value => navigate({
				to: '/rankings/global', search: {
					country: value || undefined, page: 1, 
				}, 
			})} />

			<div className='page-contents'>
				<PlayerLeaderboard sort={'pp'} country={country} page={page} players={players} />
			</div>
		</main>
	);
}
