import { useNavigate } from '@tanstack/react-router';
import { GoodGrade } from '@osu-idle/shared/judgement';
import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerGradesLeaderboard from '../../components/leaderboard/PlayerGradesLeaderboard';
import type { getGradesRanking } from '../../api/rankings';
import RankingsNav from './RankingsNav';

type Players = Awaited<ReturnType<typeof getGradesRanking>>;

export default function GradesRankings({ grade, page, country, players }: {
	grade: GoodGrade | 'all',
	page: number,
	country?: string,
	players: Players,
}) {
	const navigate = useNavigate();
	return (
		<main>
			<RankingsNav current={'grades'} />
			<CountryFilter selected={country} onSelect={value => navigate({
				to: '/rankings/grades/$grade', params: { grade }, search: {
					country: value || undefined, page: 1, 
				}, 
			})} />

			<div className='page-contents'>
				<PlayerGradesLeaderboard sort={grade} country={country} page={page} players={players} />
			</div>
		</main>
	);
}
