import './PlayerLeaderboard.css';
import Link from '../Link';
import type { getSkillRanking } from '../../api/rankings';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import { level } from '@osu-idle/shared/display/num';
import { Skills } from '@osu-idle/shared/skills';
import {
	mapped,
	ValueIn,
} from '@osu-idle/shared/helpers/mapped';
import { skillName } from '@osu-idle/shared/display/skills';
import { Trans } from '@lingui/react/macro';

export const SkillSorts = ['overall', ...Skills] as const;
export const SKILL_SORT = mapped(SkillSorts);
export type SkillSort = ValueIn<typeof SKILL_SORT>;

type Players = Awaited<ReturnType<typeof getSkillRanking>>;

export default function PlayerSkillLeaderboard({ page, sort, country, players }: {
	sort: SkillSort,
	page: number,
	country?: string,
	players: Players,
}) {
	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span><Trans>Sort by</Trans></span>
			{SkillSorts.map(type => <Link
				to='/rankings/skills/$skill'
				params={{ skill: type }}
				search={{
					page: 1, country, 
				}}
				className={`${sort === type ? 'current' : ''}`}>
				{skillName(type)}
			</Link>)}
		</div>

		<table className='player__lb_listing player__lb_listing_skill'>
			<thead>
				<th></th>
				<th></th>
				{SkillSorts.map(s => <th className={sort === SKILL_SORT[s] ? 'current' : ''}>{skillName(s)}</th>)}
			</thead>
			<tbody>
				{players.map((player, r) => <tr>
					<td>{rank(r+1+((page - 1) * 50))}</td>
					<td className='main'><div className='player__lb_listing_main'>
						<Flag country={player.user.country} />
						<Link to='/c/$id' params={{ id: String(player.character.id) }}>{player.character.name}</Link>
					</div></td>
					{SkillSorts.map(s => <td className={sort === SKILL_SORT[s] ? '' : 'dimmed'}>
						{level(player.character[`${s}Level`], player.character[`${s}Xp`])}
					</td>)}
				</tr>)}
			</tbody>
		</table>
	</div>);
}
