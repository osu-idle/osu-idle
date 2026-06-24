import { Trans } from '@lingui/react/macro';
import type { Addon as InstalledAddon } from '../../db/schema/addon';
import AddonIcon from './AddonIcon';

type Props = {
	addon: InstalledAddon,
	busy: boolean,
	hasUpdate: boolean,
	onToggle: (enabled: boolean) => void,
	onDetails: () => void,
	onUpdate: () => void,
	onUninstall: () => void,
};

/** A row in the "Installed" list. */
export default function InstalledAddonRow({
	addon, 
	busy, 
	hasUpdate,
	onToggle, 
	onDetails, 
	onUpdate, 
	onUninstall, 
}: Props) {
	return (
		<div className={`addon ${addon.enabled ? 'is-on' : ''}`}>
			<AddonIcon icon={addon.icon} name={addon.name} />
			<div className='addon__main'>
				<div className='addon__name'>
					{addon.name}<span className='addon__ver'>v{addon.version}</span>
				</div>
				<div className='addon__by'><Trans>by</Trans> {addon.authorName}</div>
			</div>
			<div className='addon__actions'>
				<label className='addon-toggle'>
					<input 
						type='checkbox' 
						checked={addon.enabled} 
						disabled={busy} 
						onChange={e => onToggle(e.target.checked)} 
					/>
					<span>
						<Trans>Enabled</Trans>
					</span>
				</label>
				<button 
					className='addon-btn' 
					disabled={busy} 
					onClick={onDetails}>
					<Trans>Details</Trans>
				</button>
				{hasUpdate && <button 
					className='addon-btn addon-btn--primary'
					disabled={busy} 
					onClick={onUpdate}
				>
					<Trans>Update</Trans>
				</button>}
				<button 
					className='addon-btn addon-btn--danger' 
					disabled={busy} 
					onClick={onUninstall}
				>
					<Trans>Uninstall</Trans>
				</button>
			</div>
		</div>
	);
}
