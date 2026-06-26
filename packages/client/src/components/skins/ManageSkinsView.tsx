import {
	useEffect,
	useState,
} from 'react';
import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Auth from '../../online/auth';
import PageBarActions from '../page/PageBarActions';
import { currentSkinDAO } from '../../osu/skin/Skin';
import { installedSkins } from '../../db/schema/skin';
import {
	deleteSkin,
	getSkin,
	mySkins,
	publishSkin,
	Skin as SkinDTO,
	SkinDetail,
} from '../../online/skins';
import SkinView from './SkinView';
import MySkinRow from './MySkinRow';
import { install } from './BrowseSkinsView';
import SkinDAORow from './SkinDAORow';

type Editing = { skin?: SkinDTO };

/** Compare two `1.2.3` strings: true when `b` is strictly newer than `a`. */
const isNewer = (a: string, b: string): boolean => {
	const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) > (pa[i] ?? 0);
	}
	return false;
};

export default function ManageSkinsView() {
	const [user] = useSynced(Auth.user);
	const [installed] = useSynced(installedSkins);
	const [editing, setEditing] = useState<Editing | undefined>();
	const [details, setDetails] = useState<SkinDetail | undefined>();
	const [mine, setMine] = useState<SkinDTO[]>([]);
	const [latest, setLatest] = useState<Record<number, string>>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const refreshMine = () => {
		if (!user) { setMine([]); return Promise.resolve(); }
		return mySkins().then(setMine).catch(e => setError(String(e.message ?? e)));
	};
	useEffect(() => { void refreshMine(); }, [user]);

	useEffect(() => {
		Promise.all(installed.map(a =>
			getSkin(a.id).then(d => [a.id, d.version] as const).catch(() => undefined),
		)).then(pairs => {
			const existing = pairs.filter(Boolean) as [number, string][];
			setLatest(Object.fromEntries(existing));
		});
	}, [installed]);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setError(undefined);
		try { await fn(); await refreshMine(); }
		catch (e) { setError(String((e as Error).message ?? e)); }
		finally { setBusy(false); }
	};

	if (editing) {
		return (
			<SkinView
				editing={true}
				detail={editing.skin}
				onBack={() => setEditing(undefined)}
				onSaved={() => { setEditing(undefined); void refreshMine(); }}
			/>
		);
	}
	if (details) {
		return <SkinView 
			detail={details}
			onBack={() => setDetails(undefined)} 
		/>;
	}

	return (
		<>
			<div className='page__section'><Trans>Your skins</Trans></div>

			{!user && <p className='page__muted'>
				<Trans>Sign in to create and publish skins.</Trans>
			</p>}
			{user && mine.length === 0 && <p className='page__muted'>
				<Trans>You haven't created any skins yet.</Trans>
			</p>}

			<div className='page__list'>
				{mine.map(a => (
					<MySkinRow
						key={a.id}
						skin={a}
						busy={busy}
						onEdit={() => setEditing({ skin: a })}
						onSubmit={() => run(() => publishSkin(a.id))}
						onInstall={() => run(() => install(a))}
						onDelete={() => run(() => deleteSkin(a.id))}
					/>
				))}
			</div>

			<div className='page__section'><Trans>Installed</Trans></div>
			{installed.length === 0 && <p className='page__muted'>
				<Trans>No skins installed. Browse the catalog to find some.</Trans>
			</p>}

			<div className='page__list'>
				{installed.map(a => (
					<SkinDAORow
						key={a.id}
						skin={a}
						busy={busy}
						hasUpdate={latest[a.id] !== undefined && isNewer(a.version, latest[a.id])}
						onToggle={enabled => run(() => a.setEnabled(enabled))}
						onDetails={() => setDetails(a)}
						onUpdate={() => run(async () => {
							const remote = await getSkin(a.id);
							if (!remote) return;
							await a.update({
								name: remote.name,
								description: remote.description,
								version: remote.version,
								definition: remote.definition,
								icon: remote.icon,
								status: remote.status,
							});
							if (currentSkinDAO.get()?.id === a.id) currentSkinDAO.set(a);
						})}
						onUninstall={() => a.uninstall()}
					/>
				))}
			</div>

			{error && <div className='page__error'>{error}</div>}

			{user && (
				<PageBarActions actions={[
					{
						id: 'create',
						label: <Trans>Create new skin</Trans>,
						onClick: () => setEditing({}),
						order: 10,
					},
				]} />
			)}
		</>
	);
}
