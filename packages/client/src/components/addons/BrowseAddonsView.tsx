import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { Addon as InstalledAddon, addonsVersion } from '../../db/schema/addon';
import { enableAddon } from '../../addons/runtime';
import { addonIconUrl, browseAddons, type Addon } from '../../online/addons';
import ArmedButton from './ArmedButton';

type Sort = 'created' | 'updated';

/** Persist a catalog add-on locally and enable it. */
const install = async (dto: Addon) => {
	const installed = await new InstalledAddon({
		id: dto.id,
		name: dto.name,
		description: dto.description,
		version: dto.version,
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
	const [query, setQuery] = useState('');
	const [sort, setSort] = useState<Sort>('created');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => { void InstalledAddon.getAll().then(rows => setInstalledIds(new Set(rows.map(r => r.id)))); }, [version]);

	const refresh = () => {
		setError(undefined);
		return browseAddons({ q: query.trim() || undefined, sort, dir: 'desc' })
			.then(setList)
			.catch(e => setError(String(e.message ?? e)));
	};
	useEffect(() => { void refresh(); }, [sort]);

	const onInstall = (dto: Addon) => {
		setBusy(true);
		void install(dto).catch(e => setError(String((e as Error).message ?? e))).finally(() => setBusy(false));
	};

	return (
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
					<button className={`addons__sort-btn ${sort === 'created' ? 'is-active' : ''}`} onClick={() => setSort('created')}><Trans>Newest</Trans></button>
					<button className={`addons__sort-btn ${sort === 'updated' ? 'is-active' : ''}`} onClick={() => setSort('updated')}><Trans>Updated</Trans></button>
				</div>
			</div>

			{error && <div className='addons__error'>{error}</div>}
			{!list && <p className='addons__muted'><Trans>Loading…</Trans></p>}
			{list && list.length === 0 && <p className='addons__muted'><Trans>No add-ons found.</Trans></p>}

			<div className='addons__list'>
				{list?.map(a => (
					<div key={a.id} className='addon'>
						{a.icon
							? <img className='addon__icon' src={addonIconUrl(a.icon)} alt='' />
							: <div className='addon__icon addon__icon--empty'>{a.name.slice(0, 1).toUpperCase()}</div>}
						<div className='addon__main'>
							<div className='addon__name'>{a.name}<span className='addon__ver'>v{a.version}</span></div>
							<div className='addon__by'><Trans>by</Trans> {a.authorName}</div>
							{a.description && <div className='addon__desc'>{a.description}</div>}
							{a.tags.length > 0 && <div className='addon__tags'>{a.tags.map(tag => <span key={tag} className='addon__tag'>{tag}</span>)}</div>}
						</div>
						<div className='addon__actions'>
							{installedIds.has(a.id)
								? <span className='addon__installed'><Trans>Installed</Trans></span>
								: <ArmedButton
									className='addon-btn addon-btn--primary'
									disabled={busy}
									label={<Trans>Install</Trans>}
									armedLabel={<Trans>Click again to confirm install</Trans>}
									onConfirm={() => onInstall(a)}
								/>}
						</div>
					</div>
				))}
			</div>
		</>
	);
}
