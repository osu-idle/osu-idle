import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayQueue from '../../gameplay/playQueue';

type Props = {
	/** the carousel is open beside it, so an empty queue is worth explaining */
	hint?: boolean;
};

/** What is lined up behind the running play: every row can be dropped, and the
 *  one that plays next says so. Empty, it says nothing at all - expanding a
 *  panel to announce that a queue is empty is worth less than the layout it
 *  shifts. */
export default function DockQueue({ hint = false }: Props) {
	const { t } = useLingui();
	const [queue] = useSynced(PlayQueue.state);
	if (!queue?.entries.length) {
		if (!hint) return null;
		return (
			<div className="dock__queue">
				<div className="dock__empty">
					<Trans>Nothing queued. Click a map to add it.</Trans>
				</div>
			</div>
		);
	}

	// the queue is what is waiting: the first row is what plays next
	const rows = queue.entries.map((beatmap, index) => ({
		beatmap, index,
	}));

	return (
		<div className="dock__queue">
			<div className="dock__label">
				<Trans>Up next</Trans> · {rows.length}
			</div>
			{rows.map(({ beatmap, index }) => (
				<div
					key={`${beatmap.metadata.id}-${index}`}
					className={`dock__entry ${index === 0 ? 'is-next' : ''}`}
				>
					<span className="dock__entry-name">
						{beatmap.set.metadata.artist} - {beatmap.set.metadata.title}
						<span> [{beatmap.metadata.version}]</span>
					</span>
					{index === 0 && <span className="dock__next"><Trans>next</Trans></span>}
					<span className="dock__entry-actions">
						<button
							type="button"
							disabled={index === 0}
							title={t`Move it up - the top of the queue plays next`}
							onClick={() => PlayQueue.move(index, index - 1)}
						>
							↑
						</button>
						<button
							type="button"
							disabled={index === rows.length - 1}
							title={t`Move it down`}
							onClick={() => PlayQueue.move(index, index + 1)}
						>
							↓
						</button>
						<button
							type="button"
							title={t`Take it out of the queue`}
							onClick={() => PlayQueue.remove(index)}
						>
							<Trans>remove</Trans>
						</button>
					</span>
				</div>
			))}
		</div>
	);
}
