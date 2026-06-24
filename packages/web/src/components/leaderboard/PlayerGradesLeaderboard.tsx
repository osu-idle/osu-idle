import './PlayerLeaderboard.css';
import Link from '../Link';
import int from '@osu-idle/shared/math/int';
import type { getGradesRanking } from '../../api/rankings';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import {
	GoodGrade,
	GoodGrades,
} from '@osu-idle/shared/judgement';
import sum from '@osu-idle/shared/helpers/sum';

type Sort = GoodGrade | 'all';

type Players = Awaited<ReturnType<typeof getGradesRanking>>;

export default function PlayerGradesLeaderboard({ sort, country, page, players }: {
	sort: Sort,
	page: number,
	country?: string,
	players: Players,
}) {
	const { t } = useLingui();

	const sorts = [...GoodGrades, 'all'] as const;
	const sortLabel = (sort: Sort) => sort === 'all' ? t`Total` : sort;

	type Player = Players[number];

	const totalGrades = (p: Player) =>
		sum(GoodGrades.map(g => p.character_totals[g]));

	const untie = (a: Player, b: Player) => {
		if (a.character_totals.X !== b.character_totals.X)
			return b.character_totals.X - a.character_totals.X;

		if (a.character_totals.SS !== b.character_totals.SS)
			return b.character_totals.SS - a.character_totals.SS;

		if (a.character_totals.S !== b.character_totals.S)
			return b.character_totals.S - a.character_totals.S;

		if (a.character_totals.A !== b.character_totals.A)
			return b.character_totals.A - a.character_totals.A;

		return totalGrades(b) - totalGrades(a);
	};

	const sortedPlayers = [...players].sort((a, b) => {
		const aScore = sort === 'all'
			? sum(GoodGrades.map(g => a.character_totals[g]))
			: a.character_totals[sort];

		const bScore = sort === 'all'
			? sum(GoodGrades.map(g => b.character_totals[g]))
			: b.character_totals[sort];

		// preserve original order when not tied
		if (aScore !== bScore)
			return 0;

		return untie(a, b);
	});

	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span><Trans>Sort by</Trans></span>
			{sorts.map(type => <Link
				to='/rankings/grades/$grade'
				params={{ grade: type }}
				search={{
					page, country, 
				}}
				className={`${sort === type ? 'current' : ''}`}>
				{sortLabel(type)}
			</Link>)}
		</div>

		<table className='player__lb_listing'>
			<thead>
				<th></th>
				<th></th>
				<th><Trans>Accuracy</Trans></th>
				<th><Trans>Play Count</Trans></th>
				<th><Trans>Ranked Score</Trans></th>
				<th><Trans>Performance</Trans></th>
				{...sorts.map(type => <th className={sort === type ? 'current' : ''}>
					{sortLabel(type)}
				</th>)}
			</thead>
			<tbody>
				{sortedPlayers.map((player, r) => <tr>
					<td>{rank(r+1+((page - 1) * 50))}</td>
					<td className='main'><div className='player__lb_listing_main'>
						<Flag country={player.user.country} />
						<Link to='/c/$id' params={{ id: String(player.character.id) }}>{player.character.name}</Link>
					</div></td>
					<td className='dimmed'>{accuracy(hitAccuracy(player.character_totals))}</td>
					<td className='dimmed'>{num(player.character_totals.playCount)}</td>
					<td className='dimmed'>{num(player.character_totals.rankedScore)}</td>
					<td className='dimmed'>{num(int(player.character.pp) ?? 0)}</td>
					{...GoodGrades.map(type => <td className={sort === type ? '' : 'dimmed'}>
						{num(player.character_totals[type])}
					</td>)}
					<td className={sort === 'all' ? '' : 'dimmed'}>
						{num(sum(GoodGrades.map(g => player.character_totals[g])))}
					</td>
				</tr>)}
			</tbody>
		</table>
	</div>);
}
