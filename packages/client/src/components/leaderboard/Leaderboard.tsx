import './Leaderboard.css';
import { useEffect, useState } from 'react';
import { Score } from '../../db/schema/score';
import ScoreEntry from './ScoreEntry';
import { music } from '../../audio/MusicPlayer';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { ScoreDTO } from '@osu-idle/shared/score';
import { getBeatmapScores } from '../../online/services/scores';
import { SCORE_TAB, SETTINGS } from '../../db/settings';

/**
 * Score leaderboard for the currently-selected difficulty. The category is
 * switchable between Local (populated from SQLite) and Global (placeholder).
 */
export default function Leaderboard() {
	const [beatmap] = useSynced(music.beatmap);
	const [category] = useSynced(SETTINGS.leaderboard);
	const [scores, setScores] = useState<(Score | ScoreDTO)[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!beatmap) return;

		if (beatmap.metadata.id === undefined) {
			setScores([]);
			return;
		}
		let cancelled = false;
		setLoading(true);

		if (category === SCORE_TAB.LOCAL) {
			Score.forBeatmap(beatmap.metadata.id)
				.then((s) => !cancelled && setScores(s))
				.catch(() => !cancelled && setScores([]))
				.finally(() => !cancelled && setLoading(false));
		} else {
			getBeatmapScores(beatmap.metadata.id)
				.then((s) => !cancelled && setScores(s))
				.catch(() => !cancelled && setScores([]))
				.finally(() => !cancelled && setLoading(false));
		}
		return () => {
			cancelled = true;
		};
	}, [beatmap, category]);

	return (
		<aside className="lb">
			<div className="lb__tabs">
				<button
					className={`lb__tab ${category === SCORE_TAB.LOCAL ? 'is-active' : ''}`}
					onClick={() => SETTINGS.leaderboard.set(SCORE_TAB.LOCAL)}
				>
					Local
				</button>
				<button
					className={`lb__tab ${category === SCORE_TAB.GLOBAL ? 'is-active' : ''}`}
					onClick={() => SETTINGS.leaderboard.set(SCORE_TAB.GLOBAL)}
				>
					Global
				</button>
			</div>

			<div className="lb__body">
				{beatmap === undefined ? (
					<p className="lb__empty">Select a difficulty to see its scores.</p>
				) : loading ? (
					<p className="lb__empty">Loading…</p>
				) : scores.length === 0 ? (
					<p className="lb__empty">No scores yet - be the first!</p>
				) : (
					<ol className="lb__list">
						{scores.map((score, i) => (
							<ScoreEntry key={score.id} score={score} previous={i < (scores.length - 1) ? scores[i+1] : undefined} />
						))}
					</ol>
				)}
			</div>
		</aside>
	);
}
