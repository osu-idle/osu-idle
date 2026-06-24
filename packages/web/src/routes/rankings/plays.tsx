import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { msg } from '@lingui/core/macro';
import PlaysRankings from '../../pages/rankings/TopPlays';
import { pageSearch } from '../-rankingSearch';

export const Route = createFileRoute('/rankings/plays')({
	validateSearch: zodValidator(pageSearch),
	component: PlaysRankings,
	staticData: { title: msg`rankings` },
});
