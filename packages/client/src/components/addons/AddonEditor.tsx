import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ADDON_TEMPLATE } from '@osu-idle/shared/addon';
import { VERSION } from '@osu-idle/shared/version';
import { createAddon, updateAddon, type Addon } from '../../online/addons';
import AddonIconField from './AddonIconField';
import AddonCodeEditor from './AddonCodeEditor';

type Props = {
	/** The add-on being edited, or undefined to create a new one. */
	addon?: Addon,
	onClose: () => void,
	onSaved: () => void,
};

/** The form's initial field values, from the edited add-on or fresh defaults. */
const initialValues = (a?: Addon) => a ? {
	name: a.name,
	description: a.description,
	tags: a.tags.join(', '),
	version: a.version,
	gameVersion: a.gameVersion,
	icon: a.icon,
	source: a.source,
} : {
	name: '',
	description: '',
	tags: '',
	version: '0.1.0',
	gameVersion: VERSION,
	icon: null as string | null,
	source: ADDON_TEMPLATE,
};

/** Create / edit form for an authored add-on. */
export default function AddonEditor({ addon, onClose, onSaved }: Props) {
	const { t } = useLingui();
	const init = initialValues(addon);
	const [name, setName] = useState(init.name);
	const [description, setDescription] = useState(init.description);
	const [tags, setTags] = useState(init.tags);
	const [version, setVersion] = useState(init.version);
	const [gameVersion, setGameVersion] = useState(init.gameVersion);
	const [icon, setIcon] = useState<string | null>(init.icon);
	const [source, setSource] = useState(init.source);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const save = async () => {
		setBusy(true);
		setError(undefined);
		const body = {
			name: name.trim(),
			description: description.trim(),
			tags: tags.split(',').map(s => s.trim()).filter(Boolean),
			version: version.trim(),
			gameVersion: gameVersion.trim(),
			icon,
			source,
		};
		try {
			if (addon) await updateAddon(addon.id, body);
			else await createAddon(body);
			onSaved();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='addon-editor'>
			<div className='addon-editor__title'>
				{addon ? <Trans>Edit add-on</Trans> : <Trans>New add-on</Trans>}
			</div>

			<div className='addon-editor__cols'>
				<div className='addon-editor__meta'>
					{addon?.feedback && (
						<div className='addon-editor__feedback'>
							<span className='addon-editor__feedback-label'><Trans>Moderator feedback</Trans></span>
							{addon.feedback}
						</div>
					)}

					<label className='addon-field'>
						<span><Trans>Name</Trans></span>
						<input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
					</label>

					<label className='addon-field'>
						<span><Trans>Description</Trans></span>
						<textarea className='addon-desc' value={description} onChange={e => setDescription(e.target.value)} maxLength={500} />
					</label>

					<div className='addon-field-row'>
						<label className='addon-field'>
							<span><Trans>Version</Trans></span>
							<input value={version} onChange={e => setVersion(e.target.value)} placeholder='1.0.0' />
						</label>
						<label className='addon-field'>
							<span><Trans>Game version</Trans></span>
							<input value={gameVersion} onChange={e => setGameVersion(e.target.value)} />
						</label>
					</div>

					<label className='addon-field'>
						<span><Trans>Tags</Trans></span>
						<input value={tags} onChange={e => setTags(e.target.value)} placeholder={t`comma, separated, tags`} />
					</label>

					<AddonIconField value={icon} onChange={setIcon} />
				</div>

				<label className='addon-field addon-field--code'>
					<span><Trans>Code</Trans></span>
					<AddonCodeEditor value={source} onChange={setSource} />
				</label>
			</div>

			<p className='addon-editor__notice'>
				<Trans>Published add-on code must be licensed under the AGPLv3 (or a compatible licence), regardless of its source code's license.</Trans>
			</p>

			{error && <div className='addons__error'>{error}</div>}

			<div className='addon-editor__actions'>
				<button className='addon-btn' disabled={busy} onClick={onClose}><Trans>Cancel</Trans></button>
				<button className='addon-btn addon-btn--primary' disabled={busy || !name.trim()} onClick={save}>
					{busy ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
				</button>
			</div>
		</div>
	);
}
