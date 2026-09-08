import { createFileRoute } from '@tanstack/react-router';
import {
	fallback,
	zodValidator,
} from '@tanstack/zod-adapter';
import { z } from 'zod';
import { msg } from '@lingui/core/macro';
import MapRequests from '../../pages/beatmaps/MapRequests';

const requestSearch = z.object({
	filter: fallback(z.enum(['open', 'accepted', 'rejected', 'all']), 'open').default('open'),
	sort: fallback(z.enum(['support', 'date']), 'support').default('support'),
	page: fallback(z.number().int().positive(), 1).default(1),
});

export const Route = createFileRoute('/maps/requests')({
	validateSearch: zodValidator(requestSearch),
	component: MapRequestsRoute,
	staticData: { title: msg`map requests` },
});

function MapRequestsRoute() {
	const { filter, sort, page } = Route.useSearch();
	return <MapRequests filter={filter} sort={sort} page={page} />;
}
