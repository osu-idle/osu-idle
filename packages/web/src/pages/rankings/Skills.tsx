import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerSkillLeaderboard, { SkillSort } from '../../components/leaderboard/PlayerSkillLeaderboard';
import { countrySkillRankPath, globalSkillRankPath, navigate, Path } from '../../router';
import RankingsNav from './RankingsNav';

export default function SkillsRankings({ current, params: { skill, country }}: {
	current: Path,
	params: { skill?: string, country?: string }
}) {
	return (<>
		<main>
			<RankingsNav current={current} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? countrySkillRankPath((skill ?? 'overall') as SkillSort, value, 1) : globalSkillRankPath((skill ?? 'overall') as SkillSort, 1))} />

			<div className='page-contents'>
				<PlayerSkillLeaderboard sort={skill as SkillSort} country={country} />
			</div>
		</main>
	</>);
}
