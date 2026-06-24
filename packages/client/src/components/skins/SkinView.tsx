import {
	useCallback,
	useState,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import PageBarActions from '../page/PageBarActions';
import type { PageAction } from '../page/pageBar';
import { defaultSkin } from '../../osu/skin/Skin';
import {
	SkinCreateBody,
	SkinUpdateBody,
} from '@osu-idle/shared/skin';
import {
	createSkin,
	Skin,
	updateSkin,
} from '../../online/skins';
import SkinIconField from './SkinIconField';
import SkinReadMeta from './SkinReadMeta';
import SkinCodePane from './SkinCodePane';

/** Blank values for creating a new skin. */
export const newSkin = (): SkinCreateBody => ({
	name: '',
	version: '0.1.0',
	description: '',
	icon: null,
	tags: [],
	definition: JSON.stringify(defaultSkin),
});

type BarOpts = {
	editing?: boolean,
	busy: boolean,
	canSave: boolean,
	onBack: () => void,
	onSave: () => void,
	viewActions?: PageAction[],
};

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
type Props = {
	detail?: Skin | SkinCreateBody,
	editing?: boolean,
	actions?: PageAction[],
	onBack: () => void,
	onSaved?: () => void,
};

export default function SkinView({
	detail,
	editing,
	actions, 
	onBack,
	onSaved,
}: Props) {
	const { t } = useLingui();

	const skin = detail ?? newSkin();
	const id = ('id' in skin ? skin.id : undefined) as number | undefined;

	const [name, setName] = useState(skin.name);
	const [description, setDescription] = useState(skin.description);
	const [tags, setTags] = useState(skin.tags.join(', '));
	const [version, setVersion] = useState(skin.version);
	const [icon, setIcon] = useState(skin.icon);
	const [definition, setDefinition] = useState(skin.definition);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | undefined>(); 

	const save = useCallback(async () => {
		if (!editing) return;
		setBusy(true);
		setError(undefined);
		const body = {
			name: name.trim(),
			description: description.trim(),
			tags: tags.split(',').map(s => s.trim()).filter(Boolean),
			version: version.trim(),
			icon,
			definition,
		} satisfies SkinUpdateBody;
		try {
			if (id) await updateSkin(id, body);
			else await createSkin(body);
			onSaved?.();
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	}, [editing, name, description, tags, version, icon, definition]);

	return (
		<div className='skin-view'>
			<div className='skin-view__cols'>
				<div className='skin-view__meta'>
					{editing ? (
						<>
							<label className='skin-field'>
								<span><Trans>Name</Trans></span>
								<input value={name} onChange={e => setName(e.target.value)} maxLength={80} />
							</label>
							<label className='skin-field'>
								<span><Trans>Description</Trans></span>
								<textarea 
									className='skin-desc'
									value={description} 
									onChange={e => setDescription(e.target.value)} maxLength={500} 
								/>
							</label>
							<div className='skin-field-row'>
								<label className='skin-field'>
									<span><Trans>Version</Trans></span>
									<input 
										value={version} 
										onChange={e => setVersion(e.target.value)}
										placeholder='1.0.0' 
									/>
								</label>
							</div>
							<label className='skin-field'>
								<span><Trans>Tags</Trans></span>
								<input 
									value={tags}
									onChange={e => setTags(e.target.value)} 
									placeholder={t`comma, separated, tags`} 
								/>
							</label>
							<SkinIconField value={icon} onChange={setIcon} />
						</>
					) : <SkinReadMeta skin={skin} />}
				</div>
				
				<div className='addon-field addon-field--code'>
					<SkinCodePane
						editing={editing} 
						source={JSON.stringify(JSON.parse(definition), null, 2)}
						onChange={setDefinition}
					/>
				</div>
			</div>

			{error && <div className='page__error'>{error}</div>}

			<PageBarActions 
				actions={[
					...(actions ? actions : []),
					...barActions({
						editing,
						busy,
						canSave: !!name.trim(),
						onBack, 
						onSave: save,
					}),
				]}
			/>
		</div>
	);
}
