import './PlayerLeaderboard.css';
import Link from '../Link';
import int from '@osu-idle/shared/math/int';
import type { getGlobalRanking } from '../../api/rankings';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';

export type ScoreSort = 'pp' | 'rankedScore';

type Players = Awaited<ReturnType<typeof getGlobalRanking>>;

export default function PlayerLeaderboard({ sort, country, page, players }: {
	sort: ScoreSort,
	page: number,
	country?: string,
	players: Players,
}) {
	const { t } = useLingui();

	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span><Trans>Sort by</Trans></span>
			<Link to='/rankings/global' search={{
				page, country, 
			}} className={sort === 'pp' ? 'current' : ''}>{t`Performance`}</Link>
			<Link to='/rankings/score' search={{
				page, country, 
			}} className={sort === 'rankedScore' ? 'current' : ''}>{t`Ranked Score`}</Link>
		</div>

		<table className='player__lb_listing'>
			<thead>
				<th></th>
				<th></th>
				<th><Trans>Accuracy</Trans></th>
				<th><Trans>Play Count</Trans></th>
				<th className={sort === 'rankedScore' ? 'current' : ''}><Trans>Ranked Score</Trans></th>
				<th className={sort === 'pp' ? 'current' : ''}><Trans>Performance</Trans></th>
				<th>X</th>
				<th>SS</th>
				<th>S</th>
				<th>A</th>
			</thead>
			<tbody>
				{players.map((player, r) => <tr>
					<td>{rank(r+1+((page - 1) * 50))}</td>
					<td className='main'><div className='player__lb_listing_main'>
						<Flag country={player.user.country} />
						<Link to='/c/$id' params={{ id: String(player.character.id) }}>{player.character.name}</Link>
					</div></td>
					<td className='dimmed'>{accuracy(hitAccuracy(player.character_totals))}</td>
					<td className='dimmed'>{num(player.character_totals.playCount)}</td>
					<td className={`${sort === 'rankedScore' ? '' : 'dimmed'}`}>
						{num(player.character_totals.rankedScore)}
					</td>
					<td className={`${sort === 'pp' ? '' : 'dimmed'}`}>{num(int(player.character.pp) ?? 0)}</td>
					<td className='dimmed'>{num(player.character_totals.X)}</td>
					<td className='dimmed'>{num(player.character_totals.SS)}</td>
					<td className='dimmed'>{num(player.character_totals.S)}</td>
					<td className='dimmed'>{num(player.character_totals.A)}</td>
				</tr>)}
			</tbody>
		</table>
	</div>);
}
