import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import { getNews } from '../../api/news';
import NewsArticle from '../../pages/news/NewsArticle';

export const Route = createFileRoute('/news/$slug')({
	loader: ({ params }) => getNews(params.slug),
	component: NewsArticleRoute,
	staticData: { title: msg`news` },
});

function NewsArticleRoute() {
	return <NewsArticle article={Route.useLoaderData()} />;
}
