import { useState } from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { ADDON_TEMPLATE } from '@osu-idle/shared/addon';
import { VERSION } from '@osu-idle/shared/version';
import {
	createAddon,
	updateAddon,
	type Addon,
} from '../../online/addons';
import AddonIconField from './AddonIconField';
import AddonCodePane from './AddonCodePane';
import AddonReadMeta from './AddonReadMeta';
import PageBarActions from '../page/PageBarActions';
import type { PageAction } from '../page/pageBar';

/**
 * Normalised add-on info:
 * the display values (view) and initial values (edit).
 */
export type AddonDetail = {
	name: string,
	authorName: string,
	version: string,
	gameVersion: string,
	description: string,
	tags: string[],
	icon: string | null,
	source: string,
};

/** Build a detail view-model from a catalog/own add-on DTO. */
export const detailOfDTO = (a: Addon): AddonDetail => ({
	name: a.name,
	authorName: a.authorName,
	version: a.version,
	gameVersion: a.gameVersion,
	description: a.description,
	tags: a.tags,
	icon: a.icon,
	source: a.source,
});

/** Blank values for creating a new add-on. */
export const newAddonDetail = (): AddonDetail => ({
	name: '',
	authorName: '',
	version: '0.1.0',
	gameVersion: VERSION,
	description: '',
	tags: [],
	icon: null,
	source: ADDON_TEMPLATE,
});

type EditAddonprops = { 
	mode: 'edit',
	addonId?: number, 
	feedback?: string | null, 
	onSaved: () => void 
};

type ViewAddonprops = { 
	mode: 'view', 
	diffAgainst?: string,
	actions?: PageAction[]
};

type Props = {
	detail: AddonDetail,
	onBack: () => void,
} & (
	| EditAddonprops
	| ViewAddonprops
);

type BarOpts = {
	editing: boolean,
	busy: boolean,
	canSave: boolean,
	onBack: () => void,
	onSave: () => void,
	viewActions?: PageAction[],
};

/**
 * Bottom-bar actions:
 * back/cancel, plus Save (edit) or the caller's view actions.
 */
const barActions = (o: BarOpts): PageAction[] => {
	const back: PageAction = {
		id: 'back',
		label: o.editing ? <Trans>Cancel</Trans> : <Trans>Back</Trans>,
		onClick: o.onBack,
		disabled: o.busy,
		order: 10,
	};
	if (!o.editing) return [back, ...o.viewActions ?? []];
	const save: PageAction = {
		id: 'save',
		label: o.busy ? <Trans>Saving…</Trans> : <Trans>Save</Trans>,
		onClick: o.onSave,
		disabled: o.busy || !o.canSave,
		order: 20,
	};
	return [back, save];
};

/**
 * The single add-on view, shared by the editor, details, install preview and
 * update diff. Metadata sits on the left (editable inputs in edit mode, a
 * read-only summary otherwise), the code on the right; the back/return action
 * lives in the button row so it stays reachable. Moderator feedback only shows
 * while editing.
 */
export default function AddonView(props: Props) {
	const { t } = useLingui();
	const { detail, onBack } = props;
	const editing = props.mode === 'edit';
	const feedback = props.mode === 'edit' ? props.feedback : undefined;
	const diffAgainst = props.mode === 'view' ? props.diffAgainst : undefined;
	const viewActions = props.mode === 'view' ? props.actions : undefined;

	const [name, setName] = useState(detail.name);
	const [description, setDescription] = useState(detail.description);
	const [tags, setTags] = useState(detail.tags.join(', '));
	const [version, setVersion] = useState(detail.version);
	const [gameVersion, setGameVersion] = useState(detail.gameVersion ?? VERSION);
	const [icon, setIcon] = useState<string | null>(detail.icon);
	const [source, setSource] = useState(detail.source);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const save = async () => {
		if (props.mode !== 'edit') return;
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
			if (props.addonId !== undefined) await updateAddon(props.addonId, body);
			else await createAddon(body);
			props.onSaved();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='addon-view'>
			<div className='addon-view__cols'>
				<div className='addon-view__meta'>
					{editing ? (
						<>
							{feedback && (
								<div className='addon-view__feedback'>
									<span className='addon-view__feedback-label'>
										<Trans>Moderator feedback</Trans>
									</span>
									{feedback}
								</div>
							)}
							<label className='addon-field'>
								<span><Trans>Name</Trans></span>
								<input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
							</label>
							<label className='addon-field'>
								<span><Trans>Description</Trans></span>
								<textarea 
									className='addon-desc'
									value={description} 
									onChange={e => setDescription(e.target.value)} maxLength={500} 
								/>
							</label>
							<div className='addon-field-row'>
								<label className='addon-field'>
									<span><Trans>Version</Trans></span>
									<input 
										value={version} 
										onChange={e => setVersion(e.target.value)}
										placeholder='1.0.0' 
									/>
								</label>
								<label className='addon-field'>
									<span><Trans>Game version</Trans></span>
									<input value={gameVersion} onChange={e => setGameVersion(e.target.value)} />
								</label>
							</div>
							<label className='addon-field'>
								<span><Trans>Tags</Trans></span>
								<input 
									value={tags}
									onChange={e => setTags(e.target.value)} 
									placeholder={t`comma, separated, tags`} 
								/>
							</label>
							<AddonIconField value={icon} onChange={setIcon} />
						</>
					) : <AddonReadMeta detail={detail} />}
				</div>

				<div className='addon-field addon-field--code'>
					<AddonCodePane
						editing={editing} 
						source={editing ? source : detail.source}
						onChange={setSource} 
						diffAgainst={diffAgainst} 
					/>
				</div>
			</div>

			{editing && (
				<p className='addon-view__notice'>
					<Trans>Published add-on code must be licensed under the AGPLv3 (or a compatible licence), regardless of its source code's license.</Trans>
				</p>
			)}
			{error && <div className='page__error'>{error}</div>}

			<PageBarActions 
				actions={barActions({
					editing,
					busy,
					canSave: !!name.trim(),
					onBack, 
					onSave: save, 
					viewActions, 
				})}
			/>
		</div>
	);
}
