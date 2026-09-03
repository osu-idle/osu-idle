import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import { z } from 'zod';
import { zodValidator } from '@tanstack/zod-adapter';
import {
	getCharacter,
	getCharacterStats,
} from '../api/characters';
import { getGlobalRanking } from '../api/rankings';
import CharacterPreview from '../pages/characters/CharacterPreview';

/**
 * Embeddable character profile, used by the rhythmgamers.net landing page.
 *
 * With no id it shows whoever currently tops the global ranking, so the embed
 * always has something worth looking at without anyone maintaining it.
 */
const search = z.object({ c: z.coerce.number().int().positive().optional() });

export const Route = createFileRoute('/preview')({
	validateSearch: zodValidator(search),
	loaderDeps: ({ search: { c } }) => ({ c }),
	loader: async ({ deps: { c } }) => {
		let id = c;

		if (!id) {
			const top = await getGlobalRanking(1);
			id = top[0]?.character?.id;
		}

		if (!id) throw new Error('no character to show');

		const [character, stats] = await Promise.all([
			getCharacter(id),
			getCharacterStats(id),
		]);

		return { character, stats };
	},
	component: PreviewRoute,
	staticData: { title: msg`character info` },
});

function PreviewRoute() {
	const { character, stats } = Route.useLoaderData();
	return <CharacterPreview character={character} stats={stats} />;
}
