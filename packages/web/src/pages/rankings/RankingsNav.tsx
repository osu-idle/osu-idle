import { SKILL_SORT } from '../../components/leaderboard/PlayerSkillLeaderboard';
import Nav from '../../components/Nav';
import { globalSkillRankPath, Path, ROUTE } from '../../router';

export default function RankingsNav({ current }: {
	current: Path,
}) {

	return (<Nav current={current} links={[
		{
			label: 'global',
			link: ROUTE.RANKINGS_GLOBAL
		},
		{
			label: 'skills',
			link: globalSkillRankPath(SKILL_SORT.overall, 1),
		},
		{
			label: 'country',
			link: ROUTE.RANKINGS_COUNTRY
		},
		{
			label: 'top plays',
			link: ROUTE.RANKINGS_PLAYS
		},
	]}/>);
}
