import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';

/**
 * Whether the queue runs.
 *
 * A queue with nothing playing and nothing scheduled is sitting there: no play
 * is going to end and pull it along, so what it needs is a start, not a pause.
 * Once something is running (or waiting to), the same button holds it back and
 * lets it go again.
 */
export default function DockRunButton() {
	const { t } = useLingui();
	const [live] = useSynced(PlayManager.live);
	const [queue] = useSynced(PlayQueue.state);
	const [paused] = useSynced(PlayManager.paused);
	const [countdown] = useSynced(PlayManager.countdown);

	// nothing follows: there is nothing to start, hold back or let go
	if (!queue || !PlayQueue.next()) return null;

	const waiting = !!live || paused || countdown !== undefined;
	if (!waiting) {
		return (
			<button
				type="button"
				className="dock__btn"
				title={t`Start playing the queue`}
				onClick={() => PlayManager.startNow()}
			>
				<Trans>start</Trans>
			</button>
		);
	}

	return (
		<button
			type="button"
			className="dock__btn"
			title={paused
				? t`Start playing the queue again`
				: t`Let this play finish, then wait`}
			onClick={() => PlayManager.setPaused(!paused)}
		>
			{paused ? <Trans>resume</Trans> : <Trans>pause</Trans>}
		</button>
	);
}
