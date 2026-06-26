import { Trans } from '@lingui/react/macro';
import type { SkinDAO } from '../../db/schema/skin';
import SkinIcon from './SkinIcon';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { currentSkinDAO } from '../../osu/skin/Skin';

type Props = {
	skin: SkinDAO,
	busy: boolean,
	hasUpdate: boolean,
	onToggle: (enabled: boolean) => void,
	onDetails: () => void,
	onUpdate: () => void,
	onUninstall: () => void,
};

/** A row in the "Installed" list. */
export default function SkinDAORow({
	skin, 
	busy, 
	hasUpdate,
	onToggle, 
	onDetails, 
	onUpdate, 
	onUninstall, 
}: Props) {
	const [current] = useSynced(currentSkinDAO);

	return (
		<div className={`skin ${skin.id === current?.id ? 'is-on' : ''}`}>
			<SkinIcon icon={skin.icon} name={skin.name} />
			<div className='skin__main'>
				<div className='skin__name'>
					{skin.name}<span className='skin__ver'>v{skin.version}</span>
				</div>
				<div className='skin__by'><Trans>by</Trans> {skin.authorName}</div>
			</div>
			<div className='skin__actions'>
				<label className='skin-toggle'>
					<input 
						type='checkbox' 
						checked={skin.id === current?.id} 
						disabled={busy} 
						onChange={e => onToggle(e.target.checked)} 
					/>
					<span>
						<Trans>Enabled</Trans>
					</span>
				</label>
				<button 
					className='skin-btn' 
					disabled={busy} 
					onClick={onDetails}>
					<Trans>Details</Trans>
				</button>
				{hasUpdate && <button 
					className='skin-btn skin-btn--primary'
					disabled={busy} 
					onClick={onUpdate}
				>
					<Trans>Update</Trans>
				</button>}
				<button 
					className='skin-btn skin-btn--danger' 
					disabled={busy} 
					onClick={onUninstall}
				>
					<Trans>Uninstall</Trans>
				</button>
			</div>
		</div>
	);
}
