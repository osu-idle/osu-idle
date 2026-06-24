import './News.css';

import {
	NEWS_TAGS,
	type NewsDTO,
} from '@osu-idle/shared/news';
import { isAdmin } from '@osu-idle/shared/admin';

import { formatDate } from '../../api/news';
import {
	coverImage,
	tagGradient,
} from '../../components/NewsCard';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import Link from '../../components/Link';

export default function NewsArticle({ article }: { article: NewsDTO }) {
	const user = useCurrentUser();

	const tag = NEWS_TAGS[article.tag];
	const image = coverImage(article);

	return (
		<main className="page-contents">
			<Link to="/news" className="news-back">← All news</Link>

			<article>
				<div
					className="news-article__banner"
					style={image ? { backgroundImage: `url(${image})` } : { background: tagGradient(tag.hue) }}
				>
					<span className="news-card__tag" style={{ background: `hsl(${tag.hue} 55% 42%)` }}>
						{tag.label}
					</span>
				</div>

				<time className="news-article__date">{formatDate(article.publishedAt)}</time>
				<h1 className="news-article__title">{article.title}</h1>
				<p className="news-article__byline">by {article.authorName}</p>

				{/* Trusted HTML - authored by an admin (see ADMIN_USER_IDS). */}
				<div className="news-article__body" dangerouslySetInnerHTML={{ __html: article.content }} />

				{isAdmin(user?.id) && (
					<Link to="/news/admin" className="news-btn news-article__edit">Edit in admin</Link>
				)}
			</article>
		</main>
	);
}
