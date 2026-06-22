import Nav from '../../components/Nav';
import { useLingui } from '@lingui/react/macro';
import { SKILL_SORT } from '../../components/leaderboard/PlayerSkillLeaderboard';
import { countryRankPath, globalGradesRankPath, globalRankPath, globalSkillRankPath, playsRankPath } from '../../router';
import { GOOD_GRADE } from '@osu-idle/shared/judgement';

export default function RankingsNav({ current }: {
	current: string,
}) {
	const { t } = useLingui();

	return (<Nav current={current} links={[
		{
			id: 'global',
			label: t`global`,
			link: globalRankPath(1),
		},
		{
			id: 'skills',
			label: t`skills`,
			link: globalSkillRankPath(SKILL_SORT.overall, 1),
		},
		{
			id: 'grades',
			label: t`grades`,
			link: globalGradesRankPath(GOOD_GRADE.X, 1),
		},
		{
			id: 'country',
			label: t`country`,
			link: countryRankPath(1),
		},
		{
			id: 'top plays',
			label: t`top plays`,
			link: playsRankPath(1),
		},
	]}/>);
}
