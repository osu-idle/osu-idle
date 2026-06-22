import './PlayerLeaderboard.css';
import Link from '../Link';
import { characterPath, globalCountryRankPath, globalRankPath, globalScoreCountryRankPath, globalScoreRankPath, Path } from '../../router';
import int from '@osu-idle/shared/math/int';
import { getCountryGlobalRanking, getCountryScoreRanking, getGlobalRanking, getScoreRanking } from '../../api/rankings';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import Flag from '../Flag';
import rank from '@osu-idle/shared/display/rank';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';
import { Trans, useLingui } from '@lingui/react/macro';

const sorts = ['pp', 'rankedScore'] as const;
const SORT = mapped(sorts);
type Sort = ValueIn<typeof SORT>;

export default function PlayerLeaderboard({ sort, country, page }: {
	sort: Sort,
	page: number,
	country?: string,
}) {
	const { t } = useLingui();

	const getTo: {[key in Sort]: Path} = {
		[SORT.pp]: !country ? globalRankPath(page) : globalCountryRankPath(country, page),
		[SORT.rankedScore]: !country ? globalScoreRankPath(page) : globalScoreCountryRankPath(country, page),
	};

	const getRanking = {
		[SORT.pp]: (page: number) => country ? getCountryGlobalRanking(country, page) : getGlobalRanking(page),
		[SORT.rankedScore]: (page: number) => country ? getCountryScoreRanking(country, page) : getScoreRanking(page),
	};

	const players = useAsync(async () => await getRanking[sort](page), [sort, page, country]);

	const sortLabel: {[key in Sort]: string} = {
		[SORT.pp]: t`Performance`,
		[SORT.rankedScore]: t`Ranked Score`,
	};
	
	return (<div className='player__lb'>
		<div className='player__lb_sort'>
			<span><Trans>Sort by</Trans></span>
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
				<th><Trans>Accuracy</Trans></th>
				<th><Trans>Play Count</Trans></th>
				<th className={sort === SORT.rankedScore ? 'current' : ''}><Trans>Ranked Score</Trans></th>
				<th className={sort === SORT.pp ? 'current' : ''}><Trans>Performance</Trans></th>
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
