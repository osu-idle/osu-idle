import {
	useEffect,
	useState,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import type { PageAction } from '../page/pageBar';
import { currentSkin } from '../../osu/skin/Skin';
import { SkinDAO } from '../../db/schema/skin';
import {
	browseSkins,
	Skin,
} from '../../online/skins';
import ConfirmMenu, { Confirm } from '../ConfirmMenu';
import SkinIcon from './SkinIcon';
import SkinView from './SkinView';

type Sort = 'created' | 'updated';

/** Persist a catalog skin locally and enable it. */
export const install = async (skin: Skin) => {
	const installed = await (await SkinDAO.fromSkinDTO(skin)).add();
	installed.setEnabled(true);
};

export default function BrowseSkinsView() {
	const { t } = useLingui();
	const [current] = useSynced(currentSkin);
	const [installedIds, setInstalledIds] = useState<Set<number>>(new Set());
	const [list, setList] = useState<Skin[] | undefined>();
	const [detail, setDetail] = useState<Skin | undefined>();
	const [confirming, setConfirming] = useState<Confirm | undefined>();
	const [query, setQuery] = useState('');
	const [sort, setSort] = useState<Sort>('created');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => {
		void SkinDAO.getAll()
			.then(rows => setInstalledIds(new Set(rows.map(r => r.id))));
	}, [current]);

	const refresh = () => {
		setError(undefined);
		return browseSkins({
			q: query.trim() || undefined, sort, dir: 'desc', 
		})
			.then(setList)
			.catch(e => setError(String(e.message ?? e)));
	};
	useEffect(() => { void refresh(); }, [sort]);

	const doInstall = (dto: Skin) => {
		setBusy(true);
		void install(dto)
			.catch(e => setError(String((e as Error).message ?? e)))
			.finally(() => setBusy(false));
	};

	// Row action (inline, in the list).
	const installButton = (a: Skin) => installedIds.has(a.id)
		? <span className='skin__installed'><Trans>Installed</Trans></span>
		: <button 
			className='skin-btn skin-btn--primary' 
			disabled={busy} 
			onClick={() => doInstall(a)}
		>
			<Trans>Install</Trans>
		</button>;

	// Detail-view action (lives in the scene's bottom bar).
	const barInstall = (a: Skin): PageAction => installedIds.has(a.id)
		? {
			id: 'installed',
			label: <Trans>Installed</Trans>,
			static: true,
			order: 20,
		}
		: {
			id: 'install',
			label: <Trans>Install</Trans>,
			onClick: () => doInstall(a),
			disabled: busy,
			order: 20,
		};

	return (
		<>
			{detail
				? <SkinView 
					detail={detail} 
					actions={[barInstall(detail)]} 
					onBack={() => setDetail(undefined)}
				/>
				: (
					<>
						<div className='skins__toolbar'>
							<span className='skins__search-label'><Trans>Search:</Trans></span>
							<input
								className='skins__search'
								value={query}
								placeholder={t`name, author or tag`}
								onChange={e => setQuery(e.target.value)}
								onKeyDown={e => { if (e.key === 'Enter') void refresh(); }}
							/>
							<div className='skins__sort'>
								<button 
									className={`skins__sort-btn ${sort === 'created' ? 'is-active' : ''}`} 
									onClick={() => setSort('created')}
								>
									<Trans>Newest</Trans>
								</button>
								<button
									className={`skins__sort-btn ${sort === 'updated' ? 'is-active' : ''}`} 
									onClick={() => setSort('updated')}
								>
									<Trans>Updated</Trans>
								</button>
							</div>
						</div>

						{error && <div className='page__error'>{error}</div>}
						{!list && <p className='page__muted'><Trans>Loading…</Trans></p>}
						{list && list.length === 0 && <p className='page__muted'>
							<Trans>No skins found.</Trans>
						</p>}

						<div className='page__list'>
							{list?.map(a => (
								<div key={a.id} className='skin'>
									<SkinIcon icon={a.icon} name={a.name} />
									<div className='skin__main'>
										<div className='skin__name'>
											{a.name}<span className='skin__ver'>v{a.version}</span>
										</div>
										<div className='skin__by'><Trans>by</Trans> {a.authorName}</div>
										{a.description && <div className='skin__desc'>{a.description}</div>}
										{a.tags.length > 0 && <div className='skin__tags'>
											{a.tags.map(tag => <span key={tag} className='skin__tag'>{tag}
											</span>)}
										</div>}
									</div>
									<div className='skin__actions'>
										<button
											className='skin-btn' 
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
