import {
	useEffect,
	useState,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import {
	MAX_PENDING_REQUESTS,
	parseBeatmapsetId,
} from '@osu-idle/shared/beatmapRequest';
import {
	searchMapRequests,
	submitMapRequest,
	type MapSearchHit,
} from '../../api/mapRequests';
import RequestSearchHit from './RequestSearchHit';

const DEBOUNCE_MS = 250;

/** Propose a map: search the beatmap mirror by name, or paste the link of one it
 *  doesn't carry. Both paths end in the same submit, keyed by beatmapset id. */
export default function RequestForm({ pending, onSubmitted }: {
	pending: number,
	onSubmitted: () => Promise<void> | void,
}) {
	const { t } = useLingui();
	const [text, setText] = useState('');
	const [hits, setHits] = useState<MapSearchHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	// A link or an id is submitted as typed - searching for it would find nothing.
	const pasted = parseBeatmapsetId(text);
	const full = pending >= MAX_PENDING_REQUESTS;

	useEffect(() => {
		const query = text.trim();
		if (pasted !== undefined || query.length < 2) { setHits([]); return; }

		let live = true;
		setSearching(true);
		const timer = setTimeout(() => {
			searchMapRequests(query)
				.then(rows => { if (live) setHits(rows); })
				.catch(() => { if (live) setHits([]); })
				.finally(() => { if (live) setSearching(false); });
		}, DEBOUNCE_MS);

		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [text, pasted]);

	const submit = async (map: string) => {
		setBusy(true);
		setError(undefined);
		try {
			await submitMapRequest(map);
			setText('');
			setHits([]);
			await onSubmitted();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='request-form'>
			<div className='request-form__row'>
				<FontAwesomeIcon icon={faMagnifyingGlass} className='request-form__icon' />
				<input
					className='request-form__input'
					value={text}
					disabled={busy || full}
					placeholder={t`Search a 4K map, or paste its beatmapset link`}
					onChange={e => setText(e.target.value)}
					onKeyDown={e => { if (e.key === 'Enter' && pasted !== undefined) void submit(text); }}
				/>
				{pasted !== undefined && (
					<button
						className='request-form__submit'
						disabled={busy || full}
						onClick={() => void submit(text)}
					>
						<Trans>Request</Trans>
					</button>
				)}
			</div>

			{full && <p className='request-form__note'>
				<Trans>
					You already have {MAX_PENDING_REQUESTS} requests waiting. Wait for one to
					be answered before proposing another.
				</Trans>
			</p>}

			{error && <p className='request-form__error'>{error}</p>}

			{!!hits.length && (
				// Kept on screen while the next search runs, dimmed so it reads as stale.
				<div className={`request-form__hits ${searching ? 'is-loading' : ''}`}>
					{hits.map(hit => (
						<RequestSearchHit
							key={hit.setId}
							hit={hit}
							disabled={busy || full}
							onPick={setId => void submit(String(setId))}
						/>
					))}
				</div>
			)}

			{!hits.length && !searching && pasted === undefined && text.trim().length >= 2 && (
				<p className='request-form__note'>
					<Trans>
						Nothing found. If the map isn't listed, paste its beatmapset link instead.
					</Trans>
				</p>
			)}
		</div>
	);
}
