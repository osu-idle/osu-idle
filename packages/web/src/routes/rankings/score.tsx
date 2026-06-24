import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { msg } from '@lingui/core/macro';
import {
	getCountryScoreRanking,
	getScoreRanking,
} from '../../api/rankings';
import ScoreRankings from '../../pages/rankings/Score';
import { pageCountrySearch } from '../-rankingSearch';

export const Route = createFileRoute('/rankings/score')({
	validateSearch: zodValidator(pageCountrySearch),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => deps.country ?
		getCountryScoreRanking(deps.country, deps.page) 
		: getScoreRanking(deps.page),
	component: ScoreRoute,
	staticData: { title: msg`rankings` },
});

function ScoreRoute() {
	const { page, country } = Route.useSearch();
	return <ScoreRankings page={page} country={country} players={Route.useLoaderData()} />;
}
