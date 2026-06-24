import Nav from '../../components/Nav';
import Link from '../../components/Link';
import { useLingui } from '@lingui/react/macro';
import { SKILL_SORT } from '../../components/leaderboard/PlayerSkillLeaderboard';
import { GOOD_GRADE } from '@osu-idle/shared/judgement';

export default function RankingsNav({ current }: {
	current: string,
}) {
	const { t } = useLingui();

	const item = (id: string) => `nav__item ${id === current ? 'current' : ''}`;

	return (<Nav>
		<Link to='/rankings/global' search={{ page: 1 }} className={item('global')}>{t`global`}</Link>
		<Link to='/rankings/skills/$skill' 
			params={{ skill: SKILL_SORT.overall }} 
			search={{ page: 1 }} 
			className={item('skills')}>
			{t`skills`}
		</Link>
		<Link to='/rankings/grades/$grade'
			params={{ grade: GOOD_GRADE.X }} 
			search={{ page: 1 }} 
			className={item('grades')}>
			{t`grades`}
		</Link>
		<Link to='/rankings/country' search={{ page: 1 }} className={item('country')}>{t`country`}</Link>
		<Link to='/rankings/plays' search={{ page: 1 }} className={item('top plays')}>{t`top plays`}</Link>
	</Nav>);
}
