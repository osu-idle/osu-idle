import './PlayerLeaderboard.css';
import Link from '../Link';
import { characterPath, countrySkillRankPath, globalSkillRankPath, Path, useQueryParam } from '../../router';
import int from '@osu-idle/shared/math/int';
import { getCountrySkillRanking, getSkillRanking } from '../../api/rankings';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import { level } from '@osu-idle/shared/display/num';
import { Skills } from '@osu-idle/shared/skills';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

export const SkillSorts = ['overall', ...Skills] as const;
export const SKILL_SORT = mapped(SkillSorts);
export type SkillSort = ValueIn<typeof SKILL_SORT>;

const sortLabel: {[key in SkillSort]: string} = {
	[SKILL_SORT.overall]: 'Overall',
	[SKILL_SORT.accuracy]: 'Accuracy',
	[SKILL_SORT.concentration]: 'Concentration',
	[SKILL_SORT.consistency]: 'Consistency',
	[SKILL_SORT.coordination]: 'Coordination',
	[SKILL_SORT.jackspeed]: 'JackSpeed',
	[SKILL_SORT.memory]: 'Memory',
	[SKILL_SORT.reading]: 'Reading',
	[SKILL_SORT.release]: 'Release',
	[SKILL_SORT.speed]: 'Speed',
	[SKILL_SORT.speedjam]: 'Speedjam',
	[SKILL_SORT.stamina]: 'Stamina',
};

export default function PlayerSkillLeaderboard({ sort, country }: {
	sort: SkillSort,
	country?: string
}) {
	const page = int(useQueryParam('page')) ?? 1;

	const getTo = (skill: SkillSort, page: number = 1): Path => country ? countrySkillRankPath(skill, country, page) :  globalSkillRankPath(skill, page);

	const getRanking = (skill: SkillSort, country?: string) => (page: number) => country === undefined ? getSkillRanking(skill, page) : getCountrySkillRanking(skill, country, page);

	const players = useAsync(async () => await getRanking(sort, country)(page), [sort, page]);
	
	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span>Sort by</span>
			{SkillSorts.map(type => <Link
				to={getTo(type)}
				className={`${sort === type ? 'current' : ''}`}>
				{sortLabel[type]}
			</Link>)}
		</div>

		<table className='player__lb_listing player__lb_listing_skill'>
			<thead>
				<th></th>
				<th></th>
				{SkillSorts.map(s => <th className={sort === SKILL_SORT[s] ? 'current' : ''}>{`${s.charAt(0).toUpperCase()}${s.substring(1)}`}</th>)}
			</thead>
			<tbody>
				{players?.map((player, r) => <tr>
					<td>{rank(r+1+((page - 1) * 50))}</td>
					<td className='main'><div className='player__lb_listing_main'>
						<Flag country={player.user.country} />
						<Link to={characterPath(player.character.id)}>{player.character.name}</Link>
					</div></td>
					{SkillSorts.map(s => <td className={sort === SKILL_SORT[s] ? '' : 'dimmed'}>
						{level(player.character[`${s}Level`], player.character[`${s}Xp`])}
					</td>)}
				</tr>)}
			</tbody>
		</table>
	</div>);
}
