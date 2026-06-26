import {
	useEffect,
	useState,
} from 'react';
import {
	Plural,
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	Addon as InstalledAddon,
	addonsVersion,
} from '../../db/schema/addon';
import { enableAddon } from '../../addons/runtime';
import {
	browseAddons,
	recordAddonDownload,
	type Addon,
} from '../../online/addons';
import Account from '../../online/account';
import AddonIcon from './AddonIcon';
import AddonView, { detailOfDTO } from './AddonView';
import ConfirmMenu, { type Confirm } from '../ConfirmMenu';
import type { PageAction } from '../page/pageBar';

type Sort = 'created' | 'updated' | 'downloads';

/** Persist a catalog add-on locally and enable it. */
const install = async (dto: Addon) => {
	const installed = await new InstalledAddon({
		id: dto.id,
		name: dto.name,
		description: dto.description,
		version: dto.version,
		gameVersion: dto.gameVersion,
		source: dto.source,
		icon: dto.icon,
		authorId: dto.authorId,
		authorName: dto.authorName,
		tags: dto.tags.join(','),
		status: dto.status,
		enabled: false,
		installedAt: Date.now(),
	}).add();
	await enableAddon(installed);
};

export default function BrowseAddonsView() {
	const { t } = useLingui();
	const [version] = useSynced(addonsVersion);
	const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
	const [list, setList] = useState<Addon[] | undefined>();
	const [detail, setDetail] = useState<Addon | undefined>();
	const [confirming, setConfirming] = useState<Confirm | undefined>();
	const [query, setQuery] = useState('');
	const [sort, setSort] = useState<Sort>('created');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		void InstalledAddon.getAll()
			.then(rows => setInstalledIds(new Set(rows.map(r => r.id))));
	}, [version]);

	const refresh = () => {
		setError(undefined);
		return browseAddons({
			q: query.trim() || undefined, sort, dir: 'desc', 
		})
			.then(setList)
			.catch(e => setError(String(e.message ?? e)));
	};
	useEffect(() => { void refresh(); }, [sort]);

	// Count this player's install once (server dedupes); reflect the new total in
	// the list/detail. Signed-out players can't be counted, so skip the call.
	const recordDownload = async (id: number) => {
		if (!Account.character.get()) return;
		try {
			const { downloads } = await recordAddonDownload(id);
			setList(prev => prev?.map(a => a.id === id ? {
				...a, downloads, 
			} : a));
			setDetail(prev => prev && prev.id === id ? {
				...prev, downloads, 
			} : prev);
		} catch { /* a counter miss must not fail the local install */ }
	};

	const doInstall = (dto: Addon) => {
		setBusy(true);
		void install(dto)
			.then(() => recordDownload(dto.id))
			.catch(e => setError(String((e as Error).message ?? e)))
			.finally(() => setBusy(false));
	};

	const askInstall = (dto: Addon) => setConfirming({
		title: t`Install add-on`,
		sub: t`Add-ons run with full access to the game. Only install add-ons you trust. Install "${dto.name}"?`,
		confirmLabel: t`Install`,
		color: '#ff66ab',
		onConfirm: () => doInstall(dto),
	});

	// Row action (inline, in the list).
	const installButton = (a: Addon) => installedIds.has(a.id)
		? <span className='addon__installed'><Trans>Installed</Trans></span>
		: <button 
			className='addon-btn addon-btn--primary' 
			disabled={busy} 
			onClick={() => askInstall(a)}
		>
			<Trans>Install</Trans>
		</button>;

	// Detail-view action (lives in the scene's bottom bar).
	const barInstall = (a: Addon): PageAction => installedIds.has(a.id)
		? {
			id: 'installed',
			label: <Trans>Installed</Trans>,
			static: true,
			order: 20,
		}
		: {
			id: 'install',
			label: <Trans>Install</Trans>,
			onClick: () => askInstall(a),
			disabled: busy,
			order: 20,
		};

	return (
		<>
			{detail
				? <AddonView 
					mode='view' 
					detail={detailOfDTO(detail)} 
					actions={[barInstall(detail)]} 
					onBack={() => setDetail(undefined)}
				/>
				: (
					<>
						<div className='addons__toolbar'>
							<span className='addons__search-label'><Trans>Search:</Trans></span>
							<input
								className='addons__search'
								value={query}
								placeholder={t`name, author or tag`}
								onChange={e => setQuery(e.target.value)}
								onKeyDown={e => { if (e.key === 'Enter') void refresh(); }}
							/>
							<div className='addons__sort'>
								<button 
									className={`addons__sort-btn ${sort === 'created' ? 'is-active' : ''}`} 
									onClick={() => setSort('created')}
								>
									<Trans>Newest</Trans>
								</button>
								<button
									className={`addons__sort-btn ${sort === 'updated' ? 'is-active' : ''}`}
									onClick={() => setSort('updated')}
								>
									<Trans>Updated</Trans>
								</button>
								<button
									className={`addons__sort-btn ${sort === 'downloads' ? 'is-active' : ''}`}
									onClick={() => setSort('downloads')}
								>
									<Trans>Most downloaded</Trans>
								</button>
							</div>
						</div>

						{error && <div className='page__error'>{error}</div>}
						{!list && <p className='page__muted'><Trans>Loading…</Trans></p>}
						{list && list.length === 0 && <p className='page__muted'>
							<Trans>No add-ons found.</Trans>
						</p>}

						<div className='page__list'>
							{list?.map(a => (
								<div key={a.id} className='addon'>
									<AddonIcon icon={a.icon} name={a.name} />
									<div className='addon__main'>
										<div className='addon__name'>
											{a.name}<span className='addon__ver'>v{a.version}</span>
										</div>
										<div className='addon__by'>
											<Trans>by</Trans> {a.authorName}
											<span className='addon__downloads'>
												{' · '}
												<Plural value={a.downloads} one='# download' other='# downloads' />
											</span>
										</div>
										{a.description && <div className='addon__desc'>{a.description}</div>}
										{a.tags.length > 0 && <div className='addon__tags'>
											{a.tags.map(tag => <span key={tag} className='addon__tag'>{tag}
											</span>)}
										</div>}
									</div>
									<div className='addon__actions'>
										<button
											className='addon-btn' 
											onClick={() => setDetail(a)}>
											<Trans>Details</Trans>
										</button>
										{installButton(a)}
									</div>
								</div>
							))}
						</div>
					</>
				)}

			{confirming && <ConfirmMenu 
				{...confirming} 
				onClose={() => setConfirming(undefined)} 
			/>}
		</>
	);
}
