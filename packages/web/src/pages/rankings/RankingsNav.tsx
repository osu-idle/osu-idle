import { useLingui } from '@lingui/react/macro';
import { SKILL_SORT } from '../../components/leaderboard/PlayerSkillLeaderboard';
import Nav from '../../components/Nav';
import { globalSkillRankPath, Path, ROUTE } from '../../router';

export default function RankingsNav({ current }: {
	current: Path,
}) {
	const { t } = useLingui();

	return (<Nav current={current} links={[
		{
			label: t`global`,
			link: ROUTE.RANKINGS_GLOBAL
		},
		{
			label: t`skills`,
			link: globalSkillRankPath(SKILL_SORT.overall, 1),
		},
		{
			label: t`country`,
			link: ROUTE.RANKINGS_COUNTRY
		},
		{
			label: t`top plays`,
			link: ROUTE.RANKINGS_PLAYS
		},
	]}/>);
}
