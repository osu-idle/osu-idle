import { createFileRoute } from '@tanstack/react-router';
import { msg } from '@lingui/core/macro';
import {
	getCharacter,
	getCharacterStats,
} from '../../api/characters';
import CharacterPage from '../../pages/characters/CharacterPage';

export const Route = createFileRoute('/c/$id')({
	loader: ({ params }) => Promise.all([getCharacter(params.id), getCharacterStats(params.id)]),
	component: CharacterRoute,
	staticData: { title: msg`character info` },
});

function CharacterRoute() {
	const { id } = Route.useParams();
	const [character, stats] = Route.useLoaderData();
	return <CharacterPage id={id} character={character} stats={stats} />;
}
