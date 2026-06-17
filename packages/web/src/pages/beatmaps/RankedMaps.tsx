import useAsync from '@osu-idle/shared/hooks/useAsync';
import './RankedMaps.css';
import { getAllMaps, getPopularMaps } from '../../api/maps';
import { Trans, useLingui } from '@lingui/react/macro';
import { dateAgo } from '@osu-idle/shared/display/ago';
import Link from '../../components/Link';
import { beatmapListing } from '../../router';
import { bignum } from '@osu-idle/shared/display/num';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faPlayCircle } from '@fortawesome/free-solid-svg-icons';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

const SORT = mapped(['date', 'plays']);
type Sort = ValueIn<typeof SORT>;

const DIR = mapped(['desc', 'asc']);
type Dir = ValueIn<typeof DIR>;

type Sorts = {
	type: Sort,
	label: string,
	getter: (dir?: 'asc' | 'desc') => ReturnType<typeof getAllMaps> | ReturnType<typeof getPopularMaps>,
};

export default function RankedMaps({ params: { sort, dir }}: {
	params: { sort?: Sort, dir?: Dir }
}) {
	const { t } = useLingui();

	sort = sort ? sort : SORT.date;
	dir = dir ? dir : DIR.desc;

	const Sorts = {
		[SORT.date]: {
			type: SORT.date,
			label: t`Ranked`,
			getter: getAllMaps,
		},
		[SORT.plays]: {
			type: SORT.plays,
			label: t`Plays`,
			getter: getPopularMaps,
		},
	} satisfies Record<Sort, Sorts>;

	const currentSort = Sorts[sort];

	const mapsets = useAsync(async () => await currentSort.getter(dir), [sort, dir]);

	return (
		<main>
			<div className='list__beatmap_sort'>
				<span><Trans>Sort by</Trans></span>
				{...Object.values(Sorts).map(sorts => {
					const current = sorts.type === sort;
					const nextDir = current ? (dir === DIR.asc ? DIR.desc : DIR.asc) : dir;
					return (<Link
						className={`${current ? 'current' : ''} ${dir === DIR.asc ? 'asc' : 'desc'}`}
						to={beatmapListing(sorts.type, nextDir)}
					>
						{sorts.label}
						<FontAwesomeIcon icon={dir === DIR.asc ? faCaretUp : faCaretDown} />
					</Link>);
				})}
			</div>
			<div className="page-contents">
				<div className='list__beatmap-container'>
					{mapsets?.map(mapset => <div className='list__beatmap'>
						<div className='list__beatmap_background' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mapset.id}/covers/list.jpg')`}}></div>
						<div className='list__beatmap_safe'>
							<div className='list__beatmap_foreground' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mapset.id}/covers/list.jpg')`}}>
								<div className='list__beatmap_contents'>
									<span className='list__beatmap_title'>{mapset.title}</span>
									<span className='list__beatmap_artist'><Trans>by {mapset.artist}</Trans></span>
									<span className='list__beatmap_creator'><Trans>mapped by {mapset.creator}</Trans></span>
									<span className='list__beatmap_plays'><FontAwesomeIcon icon={faPlayCircle}/> {bignum(mapset.plays)}</span>
									<div className='list__beatmap_bottom'>
										<span className='list__beatmap_capsule'><Trans>Ranked</Trans></span>
										<span className='list__beatmap_ago'>{dateAgo(mapset.rankedAt)}</span>
									</div>
								</div>
							</div>
						</div>
						<div className='list__beatmap_right'></div>
					</div>)}
				</div>
			</div>
		</main>
	);
}
