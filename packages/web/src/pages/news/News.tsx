import './News.css';

import { isAdmin } from '@osu-idle/shared/admin';

import type { listNews } from '../../api/news';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Link from '../../components/Link';
import NewsCard, { articleToCard } from '../../components/NewsCard';
import { Trans } from '@lingui/react/macro';

export default function News({ articles }: { articles: Awaited<ReturnType<typeof listNews>> }) {
	const user = useCurrentUser();

	return (
		<main className="page-contents">
			{isAdmin(user?.id) && (
				<div className="news-list__toolbar">
					<Link to="/news/admin" className="news-btn">Manage news</Link>
				</div>
			)}

			{articles.length === 0 && <p className="news-msg"><Trans>No news yet. Check back soon!</Trans></p>}

			<div className="news-grid">
				{articles.map(a => <NewsCard key={a.id} {...articleToCard(a)} />)}
			</div>
		</main>
	);
}
