import { useEffect, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { ADDON_STATUS } from '@osu-idle/shared/addon';
import { addonStatusLabel } from '@osu-idle/shared/display/addon';
import Auth from '../../online/auth';
import { Addon as InstalledAddon, addonsVersion } from '../../db/schema/addon';
import { disableAddon, enableAddon, remountAddon, uninstallAddon } from '../../addons/runtime';
import { addonIconUrl, deleteAddon, getAddon, myAddons, submitAddon, type Addon } from '../../online/addons';
import type { Editing } from '../../scenes/Addons';
import AddonEditor from './AddonEditor';
import ArmedButton from './ArmedButton';

type Props = {
	/** Editor state, owned by the scene (so its bottom bar can open a new one). */
	editing: Editing | undefined,
	setEditing: (e: Editing | undefined) => void,
};

/** Compare two `1.2.3` strings: true when `b` is strictly newer than `a`. */
const isNewer = (a: string, b: string): boolean => {
	const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) > (pa[i] ?? 0);
	}
	return false;
};

/** Persist a catalog add-on's source + metadata locally and enable it. */
const installAndEnable = async (dto: Addon) => {
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

const iconOf = (icon: string | null, name: string) =>
	icon
		? <img className='addon__icon' src={addonIconUrl(icon)} alt='' />
		: <div className='addon__icon addon__icon--empty'>{name.slice(0, 1).toUpperCase()}</div>;

export default function ManageAddonsView({ editing, setEditing }: Props) {
	const [user] = useSynced(Auth.user);
	const [version] = useSynced(addonsVersion);
	const [installed, setInstalled] = useState<InstalledAddon[]>([]);
	const [mine, setMine] = useState<Addon[]>([]);
	const [latest, setLatest] = useState<Record<number, string>>({});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	useEffect(() => { void InstalledAddon.getAll().then(setInstalled); }, [version]);

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
		)).then(pairs => setLatest(Object.fromEntries(pairs.filter(Boolean) as [number, string][])));
	}, [installed]);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		setError(undefined);
		try { await fn(); await refreshMine(); }
		catch (e) { setError(String((e as Error).message ?? e)); }
		finally { setBusy(false); }
	};

	const update = (a: InstalledAddon) => run(async () => {
		const dto = await getAddon(a.id);
		await a.update({ source: dto.source, version: dto.version, name: dto.name, icon: dto.icon, status: dto.status });
		await remountAddon(a);
	});

	if (editing) {
		return (
			<AddonEditor
				addon={editing.addon}
				onClose={() => setEditing(undefined)}
				onSaved={() => { setEditing(undefined); void refreshMine(); }}
			/>
		);
	}

	return (
		<>
			<div className='addons__section'><Trans>Your add-ons</Trans></div>

			{!user && <p className='addons__muted'><Trans>Sign in to create and publish add-ons.</Trans></p>}
			{user && mine.length === 0 && <p className='addons__muted'><Trans>You haven't created any add-ons yet.</Trans></p>}

			<div className='addons__list'>
				{mine.map(a => {
					const canSubmit = a.status === ADDON_STATUS.unpublished || a.status === ADDON_STATUS.denied;
					return (
						<div key={a.id} className='addon'>
							{iconOf(a.icon, a.name)}
							<div className='addon__main'>
								<div className='addon__name'>{a.name}<span className='addon__ver'>v{a.version}</span></div>
								<div className='addon__row'>
									<span className={`addon__badge addon__badge--${a.status}`}>{addonStatusLabel(a.status)}</span>
									{a.feedback && <span className='addon__feedback'>{a.feedback}</span>}
								</div>
							</div>
							<div className='addon__actions'>
								<button className='addon-btn' disabled={busy} onClick={() => setEditing({ addon: a })}><Trans>Edit</Trans></button>
								{canSubmit && (
									<ArmedButton
										className='addon-btn addon-btn--primary'
										disabled={busy}
										label={<Trans>Submit</Trans>}
										armedLabel={<Trans>Confirm ?</Trans>}
										onConfirm={() => run(() => submitAddon(a.id))}
									/>
								)}
								<button className='addon-btn' disabled={busy} onClick={() => run(() => installAndEnable(a))}><Trans>Install</Trans></button>
								<ArmedButton
									className='addon-btn addon-btn--danger'
									disabled={busy}
									label={<Trans>Delete</Trans>}
									armedLabel={<Trans>Confirm ?</Trans>}
									onConfirm={() => run(() => deleteAddon(a.id))}
								/>
							</div>
						</div>
					);
				})}
			</div>

			<div className='addons__section'><Trans>Installed</Trans></div>
			{installed.length === 0 && <p className='addons__muted'><Trans>No add-ons installed. Browse the catalog to find some.</Trans></p>}

			<div className='addons__list'>
				{installed.map(a => {
					const hasUpdate = latest[a.id] !== undefined && isNewer(a.version, latest[a.id]);
					return (
						<div key={a.id} className={`addon ${a.enabled ? 'is-on' : ''}`}>
							{iconOf(a.icon, a.name)}
							<div className='addon__main'>
								<div className='addon__name'>{a.name}<span className='addon__ver'>v{a.version}</span></div>
								<div className='addon__by'><Trans>by</Trans> {a.authorName}</div>
							</div>
							<div className='addon__actions'>
								<label className='addon-toggle'>
									<input type='checkbox' checked={a.enabled} disabled={busy} onChange={e => run(() => e.target.checked ? enableAddon(a) : disableAddon(a))} />
									<span><Trans>Enabled</Trans></span>
								</label>
								{hasUpdate && <button className='addon-btn addon-btn--primary' disabled={busy} onClick={() => update(a)}><Trans>Update</Trans></button>}
								<button className='addon-btn addon-btn--danger' disabled={busy} onClick={() => run(() => uninstallAddon(a))}><Trans>Uninstall</Trans></button>
							</div>
						</div>
					);
				})}
			</div>

			{error && <div className='addons__error'>{error}</div>}
		</>
	);
}
