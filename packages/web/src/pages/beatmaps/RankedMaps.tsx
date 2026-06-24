import './RankedMaps.css';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { dateAgo } from '@osu-idle/shared/display/ago';
import Link from '../../components/Link';
import type {
	getAllMaps,
	getPopularMaps,
} from '../../api/maps';
import { bignum } from '@osu-idle/shared/display/num';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
	faCaretDown,
	faCaretUp,
	faPlayCircle,
} from '@fortawesome/free-solid-svg-icons';

export type MapSort = 'date' | 'plays';
export type MapDir = 'asc' | 'desc';

type Mapsets = Awaited<ReturnType<typeof getAllMaps>> | Awaited<ReturnType<typeof getPopularMaps>>;

export default function RankedMaps({ sort, dir, mapsets }: {
	sort: MapSort,
	dir: MapDir,
	mapsets: Mapsets,
}) {
	const { t } = useLingui();

	const label: Record<MapSort, string> = {
		date: t`Ranked`, plays: t`Plays`, 
	};

	return (
		<main>
			<div className='list__beatmap_sort'>
				<span><Trans>Sort by</Trans></span>
				{(['date', 'plays'] as const).map(type => {
					const current = type === sort;
					const nextDir: MapDir = current ? (dir === 'asc' ? 'desc' : 'asc') : dir;
					return (<Link
						className={`${current ? 'current' : ''} ${dir === 'asc' ? 'asc' : 'desc'}`}
						to='/maps'
						search={{
							sort: type, dir: nextDir, 
						}}
					>
						{label[type]}
						<FontAwesomeIcon icon={dir === 'asc' ? faCaretUp : faCaretDown} />
					</Link>);
				})}
			</div>
			<div className="page-contents">
				<div className='list__beatmap-container'>
					{mapsets.map(mapset => <div className='list__beatmap'>
						<div className='list__beatmap_background' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mapset.id}/covers/list.jpg')` }}></div>
						<div className='list__beatmap_safe'>
							<div className='list__beatmap_foreground' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mapset.id}/covers/list.jpg')` }}>
								<div className='list__beatmap_contents'>
									<span className='list__beatmap_title'>{mapset.title}</span>
									<span className='list__beatmap_artist'><Trans>by {mapset.artist}</Trans></span>
									<span className='list__beatmap_creator'><Trans>mapped by {mapset.creator}</Trans></span>
									<span className='list__beatmap_plays'>
										<FontAwesomeIcon icon={faPlayCircle}/> {bignum(mapset.plays)}
									</span>
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
