import { createFileRoute } from '@tanstack/react-router';
import { listNews } from '../api/news';
import {
	getGeneralStats,
	getRecentStats,
} from '../api/stats';
import { getRecentMaps } from '../api/maps';
import Home from '../pages/Home';

export const Route = createFileRoute('/')({
	loader: () => Promise.all([listNews(), getGeneralStats(), getRecentStats(), getRecentMaps()]),
	component: HomeRoute,
});

function HomeRoute() {
	const [articles, stats, recent, recentMaps] = Route.useLoaderData();
	return <Home articles={articles} stats={stats} recent={recent} recentMaps={recentMaps} />;
}
