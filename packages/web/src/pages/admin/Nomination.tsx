import './Nomination.css';

import { useEffect, useMemo, useState } from 'react';
import type { BeatmapStatus } from '@osu-idle/shared/beatmap';
import { type Nomination, deleteNomination, listNominations, updateNomination, uploadBeatmap } from '../../api/maps';
import NominationRow from './NominationRow';
import { PHASE_ORDER, phaseOf } from './nominationStatus';

type SortKey = 'status' | 'submitted' | 'ranked';
const PAGE_SIZE = 20;

const time = (iso: string | null): number => iso ? new Date(iso).getTime() : 0;

export default function NominationPage() {
	const [list, setList] = useState<Nomination[] | null>(null);
	// null = still checking, false = denied, true = authorized.
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [sort, setSort] = useState<SortKey>('submitted');
	const [asc, setAsc] = useState(false);
	const [page, setPage] = useState(0);

	// The server is the real gate: if listing the queue succeeds we're an admin.
	const refresh = () =>
		listNominations()
			.then(rows => { setList(rows); setAuthorized(true); })
			.catch(e => { setAuthorized(false); setError(String(e.message ?? e)); });

	useEffect(() => { void refresh(); }, []);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setError(null);
		try {
			await fn();
			await refresh();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	const onUpload = (file: File | undefined) => file && run(() => uploadBeatmap(file));
	const patch = (setId: number, body: { rankedAt?: string | null; status?: BeatmapStatus }) =>
		run(() => updateNomination(setId, body));
	const remove = (setId: number) => confirm('Delete this set and its files?') && run(() => deleteNomination(setId));

	const sorted = useMemo(() => {
		const dir = asc ? 1 : -1;
		const key = (r: Nomination) => sort === 'status' ? PHASE_ORDER[phaseOf(r)]
			: sort === 'ranked' ? time(r.rankedAt) : time(r.submittedAt);
		return [...(list ?? [])].sort((a, b) => (key(a) - key(b)) * dir);
	}, [list, sort, asc]);

	const toggleSort = (key: SortKey) => {
		if (sort === key) setAsc(a => !a);
		else { setSort(key); setAsc(false); }
		setPage(0);
	};

	const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
	const current = Math.min(page, pageCount - 1);
	const rows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

	const caret = (key: SortKey) => sort === key ? (asc ? ' ▲' : ' ▼') : '';
	const sortBtn = (key: SortKey, label: string) => (
		<button className={`nomination__sort-btn ${sort === key ? 'current' : ''}`} onClick={() => toggleSort(key)}>
			{label}{caret(key)}
		</button>
	);

	if (authorized === false) return <main className='nomination'><p className='nomination__error'>{error ?? 'Admins only.'}</p></main>;
	if (!list) return <main className='nomination'><p className='nomination__muted'>Loading…</p></main>;

	return (
		<main className='nomination'>
			<div className='nomination__toolbar'>
				<label className={`nomination__btn nomination__btn--primary ${busy ? 'is-disabled' : ''}`}>
					{busy ? 'Working…' : 'Upload .osz'}
					<input type='file' accept='.osz' hidden disabled={busy} onChange={e => onUpload(e.target.files?.[0])} />
				</label>
				<div className='nomination__sort'>
					<span className='nomination__muted'>Sort by</span>
					{sortBtn('status', 'Status')}
					{sortBtn('submitted', 'Submitted')}
					{sortBtn('ranked', 'Ranked')}
				</div>
				<span className='nomination__count'>{sorted.length} sets</span>
			</div>

			{error && <p className='nomination__error'>{error}</p>}

			<div className='nomination__list'>
				{rows.map(row => (
					<NominationRow key={row.id} row={row} busy={busy} onPatch={patch} onDelete={remove} />
				))}
			</div>

			{pageCount > 1 && (
				<div className='nomination__pager'>
					<button className='nomination__btn' disabled={current === 0} onClick={() => setPage(current - 1)}>Prev</button>
					<span className='nomination__muted'>Page {current + 1} of {pageCount}</span>
					<button className='nomination__btn' disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>Next</button>
				</div>
			)}
		</main>
	);
}
