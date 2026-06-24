import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import { listNews } from '../../api/news';
import News from '../../pages/news/News';

export const Route = createFileRoute('/news/')({
	loader: () => listNews(),
	component: NewsRoute,
	staticData: { title: msg`news` },
});

function NewsRoute() {
	return <News articles={Route.useLoaderData()} />;
}
