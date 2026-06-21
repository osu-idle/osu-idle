import './PlayerLeaderboard.css';
import Link from '../Link';
import { characterPath, globalCountryRankPath, globalScoreCountryRankPath, Path, ROUTE, useQueryParam } from '../../router';
import int from '@osu-idle/shared/math/int';
import { getCountryGlobalRanking, getCountryScoreRanking, getGlobalRanking, getScoreRanking } from '../../api/rankings';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

const sorts = ['pp', 'rankedScore'] as const;
const SORT = mapped(sorts);
type Sort = ValueIn<typeof SORT>;

const sortLabel: {[key in Sort]: string} = {
	[SORT.pp]: 'Performance',
	[SORT.rankedScore]: 'Ranked Score',
};

export default function PlayerLeaderboard({ sort, country }: {
	sort: Sort,
	country?: string,
}) {
	const page = int(useQueryParam('page')) ?? 1;

	const getTo: {[key in Sort]: Path} = {
		[SORT.pp]: !country ? ROUTE.RANKINGS_GLOBAL : globalCountryRankPath(country),
		[SORT.rankedScore]: !country ? ROUTE.RANKINGS_GLOBAL_SCORE : globalScoreCountryRankPath(country),
	};

	const getRanking = {
		[SORT.pp]: (page: number) => country ? getCountryGlobalRanking(country, page) : getGlobalRanking(page),
		[SORT.rankedScore]: (page: number) => country ? getCountryScoreRanking(country, page) : getScoreRanking(page),
	};

	const players = useAsync(async () => await getRanking[sort](page), [sort, page, country]);
	
	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span>Sort by</span>
			{sorts.map(type => <Link
				to={getTo[type]}
				className={`${sort === type ? 'current' : ''}`}>
				{sortLabel[type]}
			</Link>)}
		</div>

		<table className='player__lb_listing'>
			<thead>
				<th></th>
				<th></th>
				<th>Accuracy</th>
				<th>Play Count</th>
				<th className={sort === SORT.rankedScore ? 'current' : ''}>Ranked Score</th>
				<th className={sort === SORT.pp ? 'current' : ''}>Performance</th>
				<th>X</th>
				<th>SS</th>
				<th>S</th>
				<th>A</th>
			</thead>
			<tbody>
				{players?.map((player, r) => <tr>
					<td>{rank(r+1+((page - 1) * 50))}</td>
					<td className='main'><div className='player__lb_listing_main'>
						<Flag country={player.user.country} />
						<Link to={characterPath(player.character.id)}>{player.character.name}</Link>
					</div></td>
					<td className='dimmed'>{accuracy(hitAccuracy(player.character_totals))}</td>
					<td className='dimmed'>{num(player.character_totals.playCount)}</td>
					<td className={`${sort === SORT.rankedScore ? '' : 'dimmed'}`}>{num(player.character_totals.rankedScore)}</td>
					<td className={`${sort === SORT.pp ? '' : 'dimmed'}`}>{num(int(player.character.pp) ?? 0)}</td>
					<td className='dimmed'>{num(player.character_totals.X)}</td>
					<td className='dimmed'>{num(player.character_totals.SS)}</td>
					<td className='dimmed'>{num(player.character_totals.S)}</td>
					<td className='dimmed'>{num(player.character_totals.A)}</td>
				</tr>)}
			</tbody>
		</table>
	</div>);
}
