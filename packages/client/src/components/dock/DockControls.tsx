import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';
import { openPage } from '../../globals';
import DockWatchButton from './DockWatchButton';
import DockRunButton from './DockRunButton';

type Props = {
	/** the dock is filling the left column with the queue carousel open */
	left: boolean;
	onCollapse?: () => void;
};

/**
 * Everything the dock can do right now - and only that: a control with nothing
 * to act on isn't shown at all rather than shown greyed out.
 *
 * Upgrades comes first and reads apart: it is the reason to open this while a
 * play is running, and since song select's bottom bar lost its own button, the
 * way there from anywhere.
 */
export default function DockControls({ left, onCollapse }: Props) {
	const { t } = useLingui();
	const [queue] = useSynced(PlayQueue.state);
	const next = queue ? PlayQueue.next() : undefined;
	const queued = queue?.entries.length ?? 0;

	return (
		<div className="dock__controls">
			<button
				type="button"
				className="dock__btn dock__btn--upgrades"
				onClick={() => openPage.set({ page: 'character' })}
			>
				<Trans>upgrades</Trans>
			</button>

			<DockWatchButton />

			{next && (
				<button
					type="button"
					className="dock__btn"
					title={t`Drop this play and start the next map`}
					onClick={() => void PlayManager.skip()}
				>
					<Trans>skip</Trans>
				</button>
			)}

			<DockRunButton />

			{queued > 0 && (
				<button
					type="button"
					className="dock__btn"
					title={t`Empty the queue - this play still finishes`}
					onClick={() => PlayQueue.clear()}
				>
					<Trans>clear</Trans>
				</button>
			)}

			<button
				type="button"
				className="dock__btn"
				title={t`Pick maps to queue`}
				onClick={() => openPage.set(left ? undefined : { page: 'queue' })}
			>
				{left ? <Trans>close</Trans> : <Trans>queue</Trans>}
			</button>

			{onCollapse && (
				<button type="button" className="dock__btn" onClick={onCollapse}>
					<Trans>hide</Trans>
				</button>
			)}
		</div>
	);
}
