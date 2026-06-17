import './ScoreEntry.css';
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

interface Props {
	score: Score | ScoreDTO,
	previous?: { score: number },
}

export default function ScoreEntry({ score, previous }: Props) {
	const character = useAsync(async () => 
		score.characterId <= 1 ? await Character.get({ id: score.characterId }) : await getCharacter(score.characterId)
	, [score]);
	const user = useAsync(async () => character && ('userId' in character) ? getUser(character.userId) : null, [character]);

	const loaded = !!character && user !== null;

	const ago = recentTimeAgo(Date.now() - score.playedAt);

	return (
		<li key={score.id} className={`score_entry__row ${loaded ? 'loaded' : ''} ${score.pfc ? 'is-pfc' : ''}`} onClick={() => SceneManager.set(SCENE.RESULT, score)}>
			<span className="score_entry__avatar" style={{ backgroundImage: `url(${user ? user.avatarUrl : '/web/guest.png'})`}}>
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
		</li>
	);
}
