import './News.css';

import { useEffect, useState } from 'react';
import type { NewsDTO } from '@osu-idle/shared/news';
import { isAdmin } from '@osu-idle/shared/admin';

import { listNews } from '../../api/news';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Link from '../../components/Link';
import NewsCard, { articleToCard } from '../../components/NewsCard';
import { ROUTE } from '../../router';
import { Trans } from '@lingui/react/macro';

export default function News() {
	const user = useCurrentUser();
	const [articles, setArticles] = useState<NewsDTO[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		listNews().then(setArticles).catch(e => setError(String(e.message ?? e)));
	}, []);

	return (
		<main className="page-contents">
			{isAdmin(user?.id) && (
				<div className="news-list__toolbar">
					<Link to={ROUTE.NEWS_ADMIN} className="news-btn">Manage news</Link>
				</div>
			)}

			{error && <p className="news-msg news-msg--error">{error}</p>}
			{!articles && !error && <p className="news-msg">Loading…</p>}
			{articles?.length === 0 && <p className="news-msg"><Trans>No news yet. Check back soon!</Trans></p>}

			<div className="news-grid">
				{articles?.map(a => <NewsCard key={a.id} {...articleToCard(a)} />)}
			</div>
		</main>
	);
}
