import { useNavigate } from '@tanstack/react-router';
import CountryFilter from '../../components/leaderboard/CountryFilter';
// eslint-disable-next-line @stylistic/max-len
import PlayerSkillLeaderboard, { SkillSort } from '../../components/leaderboard/PlayerSkillLeaderboard';
import type { getSkillRanking } from '../../api/rankings';
import RankingsNav from './RankingsNav';

type Players = Awaited<ReturnType<typeof getSkillRanking>>;

export default function SkillsRankings({ skill, page, country, players }: {
	skill: SkillSort,
	page: number,
	country?: string,
	players: Players,
}) {
	const navigate = useNavigate();
	return (
		<main>
			<RankingsNav current={'skills'} />
			<CountryFilter selected={country} onSelect={value => navigate({
				to: '/rankings/skills/$skill', params: { skill }, search: {
					country: value || undefined, page: 1, 
				}, 
			})} />

			<div className='page-contents'>
				<PlayerSkillLeaderboard sort={skill} country={country} page={page} players={players} />
			</div>
		</main>
	);
}
