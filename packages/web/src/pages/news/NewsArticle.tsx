import './News.css';

import { useEffect, useState } from 'react';
import { NEWS_TAGS, type NewsDTO } from '@osu-idle/shared/news';
import { isAdmin } from '@osu-idle/shared/admin';

import { getNews, formatDate } from '../../api/news';
import { coverImage, tagGradient } from '../../components/NewsCard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Link from '../../components/Link';
import { PageProps, ROUTE } from '../../router';

export default function NewsArticle({ params }: PageProps) {
	const slug = params.slug;
	const user = useCurrentUser();
	const [article, setArticle] = useState<NewsDTO | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setArticle(null);
		setError(null);
		getNews(slug).then(setArticle).catch(e => setError(String(e.message ?? e)));
	}, [slug]);

	const tag = article && NEWS_TAGS[article.tag];
	const image = article && coverImage(article);

	return (
		<main className="page-contents">
			<Link to={ROUTE.NEWS} className="news-back">← All news</Link>

			{error && <p className="news-msg news-msg--error">{error}</p>}
			{!article && !error && <p className="news-msg">Loading…</p>}

			{article && tag && (
				<article>
					<div
						className="news-article__banner"
						style={image ? { backgroundImage: `url(${image})` } : { background: tagGradient(tag.hue) }}
					>
						<span className="news-card__tag" style={{ background: `hsl(${tag.hue} 55% 42%)` }}>{tag.label}</span>
					</div>

					<time className="news-article__date">{formatDate(article.publishedAt)}</time>
					<h1 className="news-article__title">{article.title}</h1>
					<p className="news-article__byline">by {article.authorName}</p>

					{/* Trusted HTML - authored by an admin (see ADMIN_USER_IDS). */}
					<div className="news-article__body" dangerouslySetInnerHTML={{ __html: article.content }} />

					{isAdmin(user?.id) && (
						<Link to={ROUTE.NEWS_ADMIN} className="news-btn news-article__edit">Edit in admin</Link>
					)}
				</article>
			)}
		</main>
	);
}
