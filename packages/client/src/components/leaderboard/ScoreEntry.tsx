import './ScoreEntry.css';
import { useState } from 'react';
import { Score } from '../../db/schema/score';
import Character from '../../db/schema/character';
import SceneManager, { SCENE } from '../../scenes/SceneManager';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { ScoreDTO } from '@osu-idle/shared/score';
import { getCharacter } from '../../online/services/characters';
import Skin from '../../osu/skin/Skin';
import { getUser } from '../../online/services/users';
import { recentTimeAgo } from '@osu-idle/shared/display/ago';
import Entities from '../../entity/entities';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';
import ScoreTooltip from './ScoreTooltip';

interface Props {
	score: Score | ScoreDTO,
	previous?: { score: number },
	rank?: number,
}

type EntryCharacter = Character | Awaited<ReturnType<typeof getCharacter>>;

/** Server characters carry a resolved avatar (custom upload or osu! fallback);
 *  the local Guest has none, so fall back to the user avatar then the default. */
function entryAvatar(character: EntryCharacter | undefined, userAvatarUrl: string | null | undefined) {
	if (character && 'avatarUrl' in character && character.avatarUrl) return character.avatarUrl;
	return userAvatarUrl || GUEST_AVATAR_URL;
}

export default function ScoreEntry({ score, previous, rank }: Props) {
	const character = useAsync(async () =>
		score.characterId <= 1 ? await Character.get({ id: score.characterId }) : await getCharacter(score.characterId)
	, [score]);
	const user = useAsync(async () => character && ('userId' in character) ? getUser(character.userId) : null, [character]);

	const loaded = !!character && user !== null;

	const ago = recentTimeAgo(Date.now() - score.playedAt);

	const [hover, setHover] = useState(false);
	const [mouse, setMouse] = useState({ x: 0, y: 0 });

	return (
		<li
			key={score.id}
			className={`score_entry__row ${loaded ? 'loaded' : ''} ${score.pfc ? 'is-pfc' : ''}`}
			onClick={() => SceneManager.set(SCENE.RESULT, score)}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			onMouseMove={e => setMouse({ x: e.clientX, y: e.clientY })}
		>
			<span className="score_entry__avatar" style={{ backgroundImage: `url(${entryAvatar(character, user?.avatarUrl)})`}}>
				{rank !== undefined && <span className="score_entry__rank">#{rank}</span>}
			</span>
			<span className="score_entry__grade">
				{Skin.grade(score.grade)}
			</span>
			<span className="score_entry__main">
				<span className={`score_entry__name ${character?.name === Entities.character.get().name ? 'score_self' : ''}`}>
					{character ? character.name : 'Loading...'}
				</span>
				<span className="score_entry__score">
					{`Score: ${score.score.toLocaleString()} (${score.maxCombo}x)`}
				</span>
			</span>
			<span className="score_entry__stats">
				<span className="score_entry__mods">
					‎ 
				</span>
				<span className="score_entry__acc">
					{(score.accuracy * 100).toFixed(2)}%
				</span>
				<span className="score_entry__diff">
					{previous && previous.score < score.score ? `+${(score.score - previous.score).toLocaleString()}` : '-'}
				</span>
			</span>

			{ago && <span className="score_entry__time">
				<img src="/new.png"/>
				{ago}
			</span>}

			{hover && <ScoreTooltip score={score} x={mouse.x} y={mouse.y} />}
		</li>
	);
}
