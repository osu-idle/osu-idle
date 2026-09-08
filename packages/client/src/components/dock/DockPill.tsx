import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayManager from '../../online/playManager';
import PlayQueue from '../../gameplay/playQueue';
import { openPage } from '../../globals';

type Props = {
	onExpand: () => void;
	/** the scene under it has a bottom bar to stay clear of */
	aboveBar?: boolean;
};

/**
 * The dock while gameplay is up: one line saying what is next, and the two ways
 * out of it. No progress bar - the playfield already draws one across the top -
 * and no accuracy, which is on screen twice over already.
 */
export default function DockPill({ onExpand, aboveBar = false }: Props) {
	const [queue] = useSynced(PlayQueue.state);
	const [countdown] = useSynced(PlayManager.countdown);

	const next = queue ? PlayQueue.next() : undefined;

	return (
		<div className={`dock dock--pill ${aboveBar ? 'dock--above-bar' : ''}`}>
			<button
				type="button"
				className="dock__body"
				onClick={onExpand}
			>
				<div className="dock__map">
					{next
						? <>
							<span className="dock__next"><Trans>next</Trans> </span>
							{next.set.metadata.artist} - {next.set.metadata.title}
							<span> [{next.metadata.version}]</span>
						</>
						: countdown !== undefined
							? <Trans>Next map in {countdown}s</Trans>
							: <Trans>Last map of the queue</Trans>}
				</div>
			</button>
			<button
				type="button"
				className="dock__btn dock__btn--upgrades"
				onClick={() => openPage.set({ page: 'character' })}
			>
				<Trans>upgrades</Trans>
			</button>
			<button
				type="button"
				className="dock__btn"
				onClick={() => openPage.set({ page: 'queue' })}
			>
				<Trans>queue</Trans>
			</button>
		</div>
	);
}
