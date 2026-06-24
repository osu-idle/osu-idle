import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { msg } from '@lingui/core/macro';
import {
	getCountryGlobalRanking,
	getGlobalRanking,
} from '../../api/rankings';
import GlobalRankings from '../../pages/rankings/Global';
import { pageCountrySearch } from '../-rankingSearch';

export const Route = createFileRoute('/rankings/global')({
	validateSearch: zodValidator(pageCountrySearch),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => deps.country ?
		getCountryGlobalRanking(deps.country, deps.page) 
		: getGlobalRanking(deps.page),
	component: GlobalRoute,
	staticData: { title: msg`rankings` },
});

function GlobalRoute() {
	const { page, country } = Route.useSearch();
	return <GlobalRankings page={page} country={country} players={Route.useLoaderData()} />;
}
