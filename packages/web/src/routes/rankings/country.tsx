import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { msg } from '@lingui/core/macro';
import CountryRankings from '../../pages/rankings/Country';
import { pageSearch } from '../-rankingSearch';

export const Route = createFileRoute('/rankings/country')({
	validateSearch: zodValidator(pageSearch),
	component: CountryRankings,
	staticData: { title: msg`rankings` },
});
