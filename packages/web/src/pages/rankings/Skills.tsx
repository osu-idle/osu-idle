import CountryFilter from '../../components/leaderboard/CountryFilter';
import PlayerSkillLeaderboard, { SkillSort } from '../../components/leaderboard/PlayerSkillLeaderboard';
import { countrySkillRankPath, globalSkillRankPath, navigate } from '../../router';
import RankingsNav from './RankingsNav';

export default function SkillsRankings({  params: { skill, country, page }}: {
	params: { skill?: string, country?: string, page?: number }
}) {
	page = page ?? 1;
	return (<>
		<main>
			<RankingsNav current={'skills'} />
			<CountryFilter selected={country} onSelect={value => navigate(value ? countrySkillRankPath((skill ?? 'overall') as SkillSort, value, 1) : globalSkillRankPath((skill ?? 'overall') as SkillSort, 1))} />

			<div className='page-contents'>
				<PlayerSkillLeaderboard sort={skill as SkillSort} country={country} page={page} />
			</div>
		</main>
	</>);
}
