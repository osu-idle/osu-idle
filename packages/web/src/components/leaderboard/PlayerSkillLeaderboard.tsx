import './PlayerLeaderboard.css';
import Link from '../Link';
import type { getSkillRanking } from '../../api/rankings';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import { level } from '@osu-idle/shared/display/num';
import { levelFromTotalXp } from '@osu-idle/shared/display/levelDisplay';
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
type Player = Players[number];

/**
 * Which measure of a skill the table is showing. The three read the same rows -
 * what a skill holds now, what it has ever earned, and how often it has been
 * reset - so they share a table rather than three near-copies of one.
 */
export const BOARDS = {
	skills: '/rankings/skills/$skill',
	lifetime: '/rankings/lifetime/$skill',
	prestige: '/rankings/prestige/$skill',
} as const;
export type Board = keyof typeof BOARDS;

const cell = (board: Board, player: Player, s: SkillSort) => {
	const c = player.character;
	if (board === 'prestige') {
		return s === 'overall'
			? Skills.reduce((n, k) => n + c[`${k}Prestige`], 0)
			: c[`${s}Prestige`];
	}
	if (board === 'lifetime') {
		return levelFromTotalXp(s === 'overall' ? c.overallLifetimeXp : c[`${s}LifetimeXp`]);
	}
	// what the skill holds now: the level, with its parts on hover
	return s === 'overall'
		? level(c.overallLevel, c.overallXp)
		: <SkillLevel
			level={c[`${s}Level`]}
			xp={c[`${s}Xp`]}
			prestige={c[`${s}Prestige`]}
			lifetimeXp={c[`${s}LifetimeXp`]}
		/>;
};

export default function PlayerSkillLeaderboard({
	page, sort, country, players, board = 'skills',
}: {
	sort: SkillSort,
	page: number,
	country?: string,
	players: Players,
	board?: Board,
}) {
	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span><Trans>Sort by</Trans></span>
			{SkillSorts.map(type => <Link
				key={type}
				to={BOARDS[board]}
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
							{cell(board, player, s)}
						</td>)}
					</tr>)}
				</tbody>
			</table>
		</div>
	</div>);
}
