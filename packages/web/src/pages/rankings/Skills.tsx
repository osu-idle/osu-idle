import LeaderboardFilters from '../../components/leaderboard/LeaderboardFilters';
import PlayerSkillLeaderboard, { SkillSort } from '../../components/leaderboard/PlayerSkillLeaderboard';
import { countrySkillRankPath, navigate, Path, ROUTE } from '../../router';
import RankingsNav from './RankingsNav';

export default function SkillsRankings({ current, params: { skill, country }}: {
	current: Path,
	params: { skill?: string, country?: string }
}) {
	return (<>
		<main>
			<RankingsNav current={current} />
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
					onSelection: (item) => { navigate(item.value === 'All' ? ROUTE.RANKINGS_SKILLS : countrySkillRankPath((skill ?? 'overall') as SkillSort, item.value, 1)); },
				}
			]} />

			<div className='page-contents'>
				<PlayerSkillLeaderboard sort={skill as SkillSort} country={country} />
			</div>
		</main>
	</>);
}
