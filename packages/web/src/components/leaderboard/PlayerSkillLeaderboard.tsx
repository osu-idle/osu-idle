import './PlayerLeaderboard.css';
import Link from '../Link';
import type { getSkillRanking } from '../../api/rankings';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import { level } from '@osu-idle/shared/display/num';
import SkillLevel from '@osu-idle/shared/display/SkillLevel';
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
				key={type}
				to='/rankings/skills/$skill'
				params={{ skill: type }}
				search={{
					page: 1, country, 
				}}
				className={`${sort === type ? 'current' : ''}`}>
				{skillName(type)}
			</Link>)}
		</div>

		<div className='player__lb_scroll'>
			<table className='player__lb_listing player__lb_listing_skill'>
				<thead>
					<tr>
						<th></th>
						<th></th>
						{SkillSorts.map(s => <th key={s} className={sort === SKILL_SORT[s] ? 'current' : ''}>
							{skillName(s)}
						</th>)}
					</tr>
				</thead>
				<tbody>
					{players.map((player, r) => <tr key={player.character.id}>
						<td>{rank(r+1+((page - 1) * 50))}</td>
						<td className='main'><div className='player__lb_listing_main'>
							<Flag country={player.user.country} />
							<Link to='/c/$id' params={{ id: String(player.character.id) }}>{player.character.name}</Link>
						</div></td>
						{SkillSorts.map(s => <td key={s} className={sort === SKILL_SORT[s] ? 'current' : 'dimmed'}>
							{/* overall stays the xp level; a skill shows what it plays at */}
							{s === 'overall'
								? level(player.character.overallLevel, player.character.overallXp)
								: <SkillLevel
									level={player.character[`${s}Level`]}
									xp={player.character[`${s}Xp`]}
									prestige={player.character[`${s}Prestige`]}
									lifetimeXp={player.character[`${s}LifetimeXp`]}
								/>}
						</td>)}
					</tr>)}
				</tbody>
			</table>
		</div>
	</div>);
}
