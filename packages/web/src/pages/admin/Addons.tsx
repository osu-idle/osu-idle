import './Addons.css';

import { useEffect, useMemo, useState } from 'react';
import type { AddonStatus } from '@osu-idle/shared/addon';
import { type AdminAddon, listAddonsAdmin, moderateAddon } from '../../api/addons';
import AddonRow from './AddonRow';

type SortKey = 'status' | 'submitted' | 'published';
const time = (iso: string | null): number => iso ? new Date(iso).getTime() : 0;
// Pending first in the queue, then on-hold, then published.
const STATUS_ORDER: Record<string, number> = { pending: 0, onHold: 1, published: 2, denied: 3, unpublished: 4 };

export default function AddonsAdmin() {
	const [list, setList] = useState<AdminAddon[] | null>(null);
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [sort, setSort] = useState<SortKey>('status');
	const [asc, setAsc] = useState(true);

	const refresh = () =>
		listAddonsAdmin()
			.then(rows => { setList(rows); setAuthorized(true); })
			.catch(e => { setAuthorized(false); setError(String(e.message ?? e)); });

	useEffect(() => { void refresh(); }, []);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setError(null);
		try { await fn(); await refresh(); }
		catch (e) { setError(String((e as Error).message ?? e)); }
		finally { setBusy(false); }
	};

	const onModerate = (id: number, body: { status: AddonStatus; feedback?: string | null }) =>
		run(() => moderateAddon(id, body));

	const sorted = useMemo(() => {
		const dir = asc ? 1 : -1;
		const key = (r: AdminAddon) => sort === 'status' ? STATUS_ORDER[r.status]
			: sort === 'published' ? time(r.publishedAt) : time(r.updatedAt);
		return [...(list ?? [])].sort((a, b) => (key(a) - key(b)) * dir);
	}, [list, sort, asc]);

	const toggleSort = (key: SortKey) => {
		if (sort === key) setAsc(a => !a);
		else { setSort(key); setAsc(false); }
	};
	const caret = (key: SortKey) => sort === key ? (asc ? ' ▲' : ' ▼') : '';
	const sortBtn = (key: SortKey, label: string) => (
		<button className={`addons-admin__sort-btn ${sort === key ? 'current' : ''}`} onClick={() => toggleSort(key)}>
			{label}{caret(key)}
		</button>
	);

	if (authorized === false) return <main className='addons-admin'><p className='addons-admin__error'>{error ?? 'Admins only.'}</p></main>;
	if (!list) return <main className='addons-admin'><p className='addons-admin__muted'>Loading…</p></main>;

	return (
		<main className='addons-admin'>
			<div className='addons-admin__toolbar'>
				<div className='addons-admin__sort'>
					<span className='addons-admin__muted'>Sort by</span>
					{sortBtn('status', 'Status')}
					{sortBtn('submitted', 'Submitted')}
					{sortBtn('published', 'Published')}
				</div>
				<span className='addons-admin__count'>{sorted.length} add-ons</span>
			</div>

			{error && <p className='addons-admin__error'>{error}</p>}

			<div className='addons-admin__list'>
				{sorted.map(row => (
					<AddonRow key={row.id} row={row} busy={busy} onModerate={onModerate} />
				))}
			</div>
		</main>
	);
}
