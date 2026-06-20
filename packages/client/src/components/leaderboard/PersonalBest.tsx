import './PersonalBest.css';
import ScoreEntry from './ScoreEntry';
import Account from '../../online/account';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { getMyBeatmapScore } from '../../online/services/scores';

interface Props {
	beatmapId: number,
}

/** The signed-in player's own best on this beatmap + its global rank, shown
 *  below the leaderboard even when it falls outside the top 50. Hidden when
 *  signed out or the player has no play here yet. */
export default function PersonalBest({ beatmapId }: Props) {
	const [account] = useSynced(Account.character);

	const best = useAsync(async () => {
		if (!account) return null;
		return getMyBeatmapScore(beatmapId).catch(() => null);
	}, [account, beatmapId]);

	if (!account || !best) return null;

	return (
		<div className="lb__pb">
			<div className="lb__pb_label">Personal best</div>
			<ol className="lb__list">
				<ScoreEntry score={best.score} rank={best.rank} />
			</ol>
		</div>
	);
}
