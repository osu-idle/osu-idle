import './Home.css';

import { listNews } from '../api/news';
import { getGeneralStats, getRecentStats } from '../api/stats';
import NewsCard, { articleToCard } from '../components/NewsCard';
import FancyGraph from '../components/FancyGraph';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import num from '@osu-idle/shared/display/num';
import { getRecentMaps } from '../api/maps';
import { dateAgo } from '@osu-idle/shared/display/ago';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons/faChevronRight';
import { Trans } from '@lingui/react/macro';

export default function Home() {
	const articles = useAsync(async () => await listNews(), []);
	const stats = useAsync(async () => await getGeneralStats(), []);
	const recent = useAsync(async () => await getRecentStats(), []);
	const recentMaps = useAsync(async () => await getRecentMaps(), []);

	return (
		<main className="dashboard">
			<section className="dashboard__left">
				<h2 className="dashboard__title"><Trans>News</Trans></h2>
				{articles?.slice(0, 6).map(a => <NewsCard key={a.id} {...articleToCard(a)} className='home-news' />)}
			</section>
			<section className="dashboard__right">
				<div className='dashboard__stats'>
					<div className='dashboard__stats_n'>
						<div className='dashboard__stats_g'>
							<div className='dashboard__stats_g-title'><Trans>Online Users</Trans></div>
							<div className='dashboard__stats_g-num'>{num(stats?.online)}</div>
						</div>
						<div className='dashboard__stats_g'>
							<div className='dashboard__stats_g-title'><Trans>Playing</Trans></div>
							<div className='dashboard__stats_g-num'>{num(stats?.playing)}</div>
						</div>

					</div>
					{recent && recent.online_hist.length > 0 && (
						<FancyGraph data={recent.online_hist} />
					)}
				</div>
				<div className='dashboard__cta'>
				</div>
				<div className='dashboard__ranked'>
					<div className='dashboard__ranked_title'>
						<Trans>New Ranked Beatmaps</Trans>
					</div>
					<div className='dashboard__ranked_list'>
						{recentMaps?.map(map => (<a className='dashboard__ranked_list_map'>
							<div className='dashboard__ranked_list_map-bg' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${map.id}/covers/list.jpg')`}}></div>
							<div className='dashboard__ranked_list_map-md'>
								<div className='dashboard__ranked_list_map-md-title'>{map.title}</div>
								<div className='dashboard__ranked_list_map-md-artist'>{map.artist}</div>
								<div className='dashboard__ranked_list_map-md-info'>
									<div className='dashboard__ranked_list_map-md-info-c'><Trans>by {map.creator}</Trans></div>
									<div className='dashboard__ranked_list_map-md-info-d'>{dateAgo(map.rankedAt)}</div>
								</div>
							</div>
							<div className='dashboard__ranked_list_map-c'>
								<FontAwesomeIcon icon={faChevronRight} />
							</div>
						</a>))}
					</div>
				</div>
			</section>
		</main>
	);
}
