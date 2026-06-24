import {
	useEffect,
	useState,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Auth from '../../online/auth';
import {
	Addon as InstalledAddon,
	addonsVersion,
} from '../../db/schema/addon';
import {
	disableAddon,
	enableAddon,
	remountAddon,
	uninstallAddon,
} from '../../addons/runtime';
import {
	deleteAddon,
	getAddon,
	myAddons,
	submitAddon,
	type Addon,
} from '../../online/addons';
import AddonView, {
	detailOfDTO,
	newAddonDetail,
	type AddonDetail,
} from './AddonView';
import MyAddonRow from './MyAddonRow';
import InstalledAddonRow from './InstalledAddonRow';
import ConfirmMenu, { type Confirm } from '../ConfirmMenu';
import PageBarActions from '../page/PageBarActions';

/** What the editor is editing: a blank draft (`{}`) or an existing add-on. */
type Editing = { addon?: Addon };

/** Compare two `1.2.3` strings: true when `b` is strictly newer than `a`. */
const isNewer = (a: string, b: string): boolean => {
	const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) > (pa[i] ?? 0);
	}
	return false;
};

const detailOfInstalled = (a: InstalledAddon): AddonDetail => ({
	name: a.name,
	authorName: a.authorName,
	version: a.version,
	gameVersion: a.gameVersion,
	description: a.description,
	tags: a.tags ? a.tags.split(',') : [],
	icon: a.icon,
	source: a.source,
});

/** Persist a catalog add-on's source + metadata locally and enable it. */
const installAndEnable = async (dto: Addon) => {
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

export default function ManageAddonsView() {
	const { t } = useLingui();
	const [user] = useSynced(Auth.user);
	const [version] = useSynced(addonsVersion);
	const [editing, setEditing] = useState<Editing | undefined>();
	const [installed, setInstalled] = useState<InstalledAddon[]>([]);
	const [mine, setMine] = useState<Addon[]>([]);
	const [latest, setLatest] = useState<Record<number, string>>({});
	const [details, setDetails] = useState<AddonDetail | undefined>();
	const [updating, setUpdating] = useState<{ 
		remote: Addon, 
		local: InstalledAddon 
	} | undefined>();
	const [confirming, setConfirming] = useState<Confirm | undefined>();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => { 
		void InstalledAddon.getAll()
			.then(setInstalled); 
	}, [version]);

	const refreshMine = () => {
		if (!user) { setMine([]); return Promise.resolve(); }
		return myAddons().then(setMine).catch(e => setError(String(e.message ?? e)));
	};
	useEffect(() => { void refreshMine(); }, [user]);

	// Look up the latest published version of each installed add-on (best effort)
	// so we can offer updates. A 404 (unpublished/removed) just yields no update.
	useEffect(() => {
		Promise.all(installed.map(a =>
			getAddon(a.id).then(d => [a.id, d.version] as const).catch(() => undefined),
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

	const openUpdate = (a: InstalledAddon) => run(async () => {
		setUpdating({
			remote: await getAddon(a.id), local: a, 
		});
	});

	const applyUpdate = () => updating && run(async () => {
		const { remote, local } = updating;
		await local.update({ 
			source: remote.source, 
			version: remote.version, 
			name: remote.name, 
			icon: remote.icon, 
			status: remote.status, 
		});
		await remountAddon(local);
		setUpdating(undefined);
	});

	if (editing) {
		return (
			<AddonView
				mode='edit'
				detail={editing.addon ? detailOfDTO(editing.addon) : newAddonDetail()}
				addonId={editing.addon?.id}
				feedback={editing.addon?.feedback}
				onBack={() => setEditing(undefined)}
				onSaved={() => { setEditing(undefined); void refreshMine(); }}
			/>
		);
	}
	if (updating) {
		return (
			<AddonView
				mode='view'
				detail={detailOfDTO(updating.remote)}
				diffAgainst={updating.local.source}
				actions={[
					{
						id: 'update',
						label: <Trans>Update</Trans>,
						onClick: applyUpdate,
						disabled: busy,
						order: 20,
					},
				]}
				onBack={() => setUpdating(undefined)}
			/>
		);
	}
	if (details) {
		return <AddonView 
			mode='view' 
			detail={details}
			onBack={() => setDetails(undefined)} 
		/>;
	}

	return (
		<>
			<div className='page__section'><Trans>Your add-ons</Trans></div>

			{!user && <p className='page__muted'>
				<Trans>Sign in to create and publish add-ons.</Trans>
			</p>}
			{user && mine.length === 0 && <p className='page__muted'>
				<Trans>You haven't created any add-ons yet.</Trans>
			</p>}

			<div className='page__list'>
				{mine.map(a => (
					<MyAddonRow
						key={a.id}
						addon={a}
						busy={busy}
						onEdit={() => setEditing({ addon: a })}
						onSubmit={() => setConfirming({
							title: t`Submit add-on`,
							sub: t`Your published code must be licensed under the AGPLv3 (or a compatible licence). This does not necessarily affect its source's license. Submit "${a.name}" for review?`,
							confirmLabel: t`Submit`,
							color: '#ff66ab',
							onConfirm: () => run(() => submitAddon(a.id)),
						})}
						onInstall={() => run(() => installAndEnable(a))}
						onDelete={() => setConfirming({
							title: t`Delete add-on`,
							sub: t`Permanently delete "${a.name}"? This cannot be undone.`,
							confirmLabel: t`Delete`,
							onConfirm: () => run(() => deleteAddon(a.id)),
						})}
					/>
				))}
			</div>

			<div className='page__section'><Trans>Installed</Trans></div>
			{installed.length === 0 && <p className='page__muted'>
				<Trans>No add-ons installed. Browse the catalog to find some.</Trans>
			</p>}

			<div className='page__list'>
				{installed.map(a => (
					<InstalledAddonRow
						key={a.id}
						addon={a}
						busy={busy}
						hasUpdate={latest[a.id] !== undefined && isNewer(a.version, latest[a.id])}
						onToggle={enabled => run(() => enabled ? enableAddon(a) : disableAddon(a))}
						onDetails={() => setDetails(detailOfInstalled(a))}
						onUpdate={() => openUpdate(a)}
						onUninstall={() => setConfirming({
							title: t`Uninstall add-on`,
							sub: t`Remove "${a.name}" ?`,
							confirmLabel: t`Uninstall`,
							onConfirm: () => run(() => uninstallAddon(a)),
						})}
					/>
				))}
			</div>

			{error && <div className='page__error'>{error}</div>}
			{confirming && <ConfirmMenu 
				{...confirming} 
				onClose={() => setConfirming(undefined)} 
			/>}

			{user && (
				<PageBarActions actions={[
					{
						id: 'create',
						label: <Trans>Create new add-on</Trans>,
						onClick: () => setEditing({}),
						order: 10,
					},
				]} />
			)}
		</>
	);
}
