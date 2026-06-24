import { Trans } from '@lingui/react/macro';
import { SKIN_STATUS } from '@osu-idle/shared/skin';
import SkinIcon from './SkinIcon';
import { skinStatusLabel } from '@osu-idle/shared/display/skin';
import { Skin } from '../../online/skins';

type Props = {
	skin: Skin,
	busy: boolean,
	onEdit: () => void,
	onSubmit: () => void,
	onInstall: () => void,
	onDelete: () => void,
};

/** A row in the author's "Your add-ons" list. */
export default function MyAddonRow({ 
	skin, 
	busy, 
	onEdit, 
	onSubmit, 
	onInstall, 
	onDelete, 
}: Props) {
	const canSubmit = skin.status === SKIN_STATUS.UNPUBLISHED;

	return (
		<div className='skin'>
			<SkinIcon icon={skin.icon} name={skin.name} />
			<div className='skin__main'>
				<div className='skin__name'>
					{skin.name}<span className='skin__ver'>v{skin.version}</span>
				</div>
				<div className='skin__row'>
					<span className={`skin__badge skin__badge--${skin.status}`}>
						{skinStatusLabel(skin.status)}
					</span>
				</div>
			</div>
			<div className='skin__actions'>
				<button 
					className='skin-btn'
					disabled={busy} 
					onClick={onEdit}
				>
					<Trans>Edit</Trans>
				</button>
				{canSubmit && <button
					className='skin-btn skin-btn--primary' 
					disabled={busy} 
					onClick={onSubmit}
				>
					<Trans>Submit</Trans>
				</button>}
				<button 
					className='skin-btn' 
					disabled={busy} 
					onClick={onInstall}
				>
					<Trans>Install</Trans>
				</button>
				<button 
					className='skin-btn skin-btn--danger'
					disabled={busy} 
					onClick={onDelete}
				>
					<Trans>Delete</Trans>
				</button>
			</div>
		</div>
	);
}
