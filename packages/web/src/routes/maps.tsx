import { createFileRoute } from '@tanstack/react-router';
import {
	zodValidator,
	fallback,
} from '@tanstack/zod-adapter';
import { z } from 'zod';
import { msg } from '@lingui/core/macro';
import {
	getAllMaps,
	getPopularMaps,
} from '../api/maps';
import RankedMaps from '../pages/beatmaps/RankedMaps';

const mapsSearch = z.object({
	sort: fallback(z.enum(['date', 'plays']), 'date').default('date'),
	dir: fallback(z.enum(['asc', 'desc']), 'desc').default('desc'),
});

export const Route = createFileRoute('/maps')({
	validateSearch: zodValidator(mapsSearch),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => deps.sort === 'plays' ? getPopularMaps(deps.dir) : getAllMaps(deps.dir),
	component: MapsRoute,
	staticData: { title: msg`beatmap listing` },
});

function MapsRoute() {
	const { sort, dir } = Route.useSearch();
	return <RankedMaps sort={sort} dir={dir} mapsets={Route.useLoaderData()} />;
}
