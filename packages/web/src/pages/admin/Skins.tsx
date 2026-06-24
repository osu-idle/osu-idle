import './Skins.css';

import {
	useEffect,
	useMemo,
	useState,
} from 'react';
import type { SkinStatus } from '@osu-idle/shared/skin';
import {
	type AdminSkin,
	listSkinsAdmin,
	moderateSkin,
} from '../../api/skins';
import SkinRow from './SkinRow';

type SortKey = 'status' | 'submitted' | 'published';
const time = (iso: string | null): number => iso ? new Date(iso).getTime() : 0;
// Pending first in the queue, then on-hold, then published.
const STATUS_ORDER: Record<string, number> = {
	pending: 0, onHold: 1, published: 2, denied: 3, unpublished: 4, 
};

export default function SkinsAdmin() {
	const [list, setList] = useState<AdminSkin[] | null>(null);
	const [authorized, setAuthorized] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [sort, setSort] = useState<SortKey>('status');
	const [asc, setAsc] = useState(true);

	const refresh = () =>
		listSkinsAdmin()
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

	const onModerate = (id: number, body: { status: SkinStatus; feedback?: string | null }) =>
		run(() => moderateSkin(id, body));

	const sorted = useMemo(() => {
		const dir = asc ? 1 : -1;
		const key = (r: AdminSkin) => sort === 'status' ? STATUS_ORDER[r.status]
			: sort === 'published' ? time(r.publishedAt) : time(r.updatedAt);
		return [...(list ?? [])].sort((a, b) => (key(a) - key(b)) * dir);
	}, [list, sort, asc]);

	const toggleSort = (key: SortKey) => {
		if (sort === key) setAsc(a => !a);
		else { setSort(key); setAsc(false); }
	};
	const caret = (key: SortKey) => sort === key ? (asc ? ' ▲' : ' ▼') : '';
	const sortBtn = (key: SortKey, label: string) => (
		<button 
			className={`skins-admin__sort-btn ${sort === key ? 'current' : ''}`}
			onClick={() => toggleSort(key)}
		>
			{label}{caret(key)}
		</button>
	);

	if (authorized === false) return <main className='skins-admin'>
		<p className='skins-admin__error'>{error ?? 'Admins only.'}</p>
	</main>;
	if (!list) return <main className='skins-admin'>
		<p className='skins-admin__muted'>Loading…</p>
	</main>;

	return (
		<main className='skins-admin'>
			<div className='skins-admin__toolbar'>
				<div className='skins-admin__sort'>
					<span className='skins-admin__muted'>Sort by</span>
					{sortBtn('status', 'Status')}
					{sortBtn('submitted', 'Submitted')}
					{sortBtn('published', 'Published')}
				</div>
				<span className='skins-admin__count'>{sorted.length} skins</span>
			</div>

			{error && <p className='skins-admin__error'>{error}</p>}

			<div className='skins-admin__list'>
				{sorted.map(row => (
					<SkinRow key={row.id} row={row} busy={busy} onModerate={onModerate} />
				))}
			</div>
		</main>
	);
}
