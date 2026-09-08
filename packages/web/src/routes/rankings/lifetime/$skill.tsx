import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { msg } from '@lingui/core/macro';
import {
	getCountryLifetimeRanking,
	getLifetimeRanking,
} from '../../../api/rankings';
import SkillsRankings from '../../../pages/rankings/Skills';
import { SkillSort } from '../../../components/leaderboard/PlayerSkillLeaderboard';
import { pageCountrySearch } from '../../-rankingSearch';

export const Route = createFileRoute('/rankings/lifetime/$skill')({
	validateSearch: zodValidator(pageCountrySearch),
	loaderDeps: ({ search }) => search,
	loader: ({ params, deps }) => deps.country
		? getCountryLifetimeRanking(params.skill as SkillSort, deps.country, deps.page)
		: getLifetimeRanking(params.skill as SkillSort, deps.page),
	component: LifetimeRoute,
	staticData: { title: msg`rankings` },
});

function LifetimeRoute() {
	const { skill } = Route.useParams();
	const { page, country } = Route.useSearch();
	return <SkillsRankings 
		skill={skill as SkillSort} 
		page={page}
		country={country} 
		players={Route.useLoaderData()}
		board='lifetime'
	/>;
}
