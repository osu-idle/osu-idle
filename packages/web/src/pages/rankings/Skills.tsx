import { useNavigate } from '@tanstack/react-router';
import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerSkillLeaderboard, {
	BOARDS,
	type Board,
	type SkillSort,
} from '../../components/leaderboard/PlayerSkillLeaderboard';
import type { getSkillRanking } from '../../api/rankings';
import RankingsNav from './RankingsNav';

type Players = Awaited<ReturnType<typeof getSkillRanking>>;

/** The skills table under one of its three measures - what a skill holds now,
 *  what it has ever earned, or how often it has been prestiged. */
export default function SkillsRankings({ skill, page, country, players, board = 'skills' }: {
	skill: SkillSort,
	page: number,
	country?: string,
	players: Players,
	board?: Board,
}) {
	const navigate = useNavigate();
	return (
		<main>
			<RankingsNav current={board} />
			<CountryFilter selected={country} onSelect={value => navigate({
				to: BOARDS[board], params: { skill }, search: {
					country: value || undefined, page: 1, 
				}, 
			})} />

			<div className='page-contents'>
				<PlayerSkillLeaderboard
					sort={skill}
					country={country}
					page={page}
					players={players}
					board={board}
				/>
			</div>
		</main>
	);
}
