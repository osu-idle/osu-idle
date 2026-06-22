import { useState } from 'react';
import type { Nomination } from '../../api/maps';
import { phaseOf } from './nominationStatus';

/** ISO timestamp -> value for an <input type="datetime-local"> (local time). */
const toLocalInput = (iso: string | null): string => {
	if (!iso) return '';
	const d = new Date(iso);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fmt = (iso: string | null): string =>
	iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const HOUR = 3600e3;
// Quick-schedule windows: a random moment within the next hour/day/week/month.
const WINDOWS: [label: string, ms: number][] = [
	['hour', HOUR],
	['day', 24 * HOUR],
	['week', 7 * 24 * HOUR],
	['month', 30 * 24 * HOUR],
];

export default function NominationRow({ row, busy, onPatch, onDelete }: {
	row: Nomination;
	busy: boolean;
	onPatch: (setId: number, body: { rankedAt?: string | null; status?: 'pending' | 'ranked' | 'rejected' }) => void;
	onDelete: (setId: number) => void;
}) {
	const [date, setDate] = useState(toLocalInput(row.rankedAt));

	const phase = phaseOf(row);
	const live = phase === 'live';

	const schedule = () => date && onPatch(row.id, { rankedAt: new Date(date).toISOString(), status: 'ranked' });
	const rankNow = () => onPatch(row.id, { rankedAt: new Date().toISOString(), status: 'ranked' });
	const scheduleIn = (ms: number) =>
		onPatch(row.id, { rankedAt: new Date(Date.now() + Math.random() * ms).toISOString(), status: 'ranked' });
	const unrank = () => onPatch(row.id, { status: 'pending', rankedAt: null });
	const reject = () => onPatch(row.id, { status: 'rejected' });

	return (
		<div className='nomination__entry'>
			<div className='nomination__info'>
				<div className='nomination__cover' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${row.id}/covers/list.jpg')` }} />
				<div className='nomination__meta'>
					<a className='nomination__title' href={`https://osu.ppy.sh/beatmapsets/${row.id}`} target='_blank' rel='noreferrer'>
						{row.artist} - {row.title}
					</a>
					<span className='nomination__creator'>by {row.creator}</span>
				</div>

				<span className={`nomination__badge nomination__badge--${phase}`}>{phase}</span>

				<div className='nomination__stat'><span className='nomination__label'>Diffs</span><span>{row.difficulties}</span></div>
				<div className='nomination__stat'><span className='nomination__label'>Plays</span><span>{row.plays ?? 0}</span></div>
				<div className='nomination__stat'><span className='nomination__label'>Submitted</span><span>{fmt(row.submittedAt)}</span></div>
				<div className='nomination__stat'>
					<span className='nomination__label'>Ranked</span>
					{live
						? <span>{fmt(row.rankedAt)}</span>
						: <input className='nomination__field' type='datetime-local' value={date} disabled={busy} onChange={e => setDate(e.target.value)} />}
				</div>
			</div>

			<div className='nomination__actions'>
				{!live && (
					<div className='nomination__quick'>
						<span className='nomination__label'>Random in</span>
						{WINDOWS.map(([label, ms]) => (
							<button key={label} className='nomination__btn' disabled={busy}
								title={`Schedule randomly within the next ${label}`} onClick={() => scheduleIn(ms)}>
								{label}
							</button>
						))}
					</div>
				)}
				{!live && <button className='nomination__btn nomination__btn--primary' disabled={busy || !date} onClick={schedule}>Schedule</button>}
				{!live && <button className='nomination__btn' disabled={busy} onClick={rankNow}>Rank now</button>}
				{row.status === 'ranked' && <button className='nomination__btn' disabled={busy} onClick={unrank}>Unrank</button>}
				{row.status === 'pending' && <button className='nomination__btn nomination__btn--warn' disabled={busy} onClick={reject}>Reject</button>}
				<button className='nomination__btn nomination__btn--danger' disabled={busy} onClick={() => onDelete(row.id)}>Delete</button>
			</div>
		</div>
	);
}
