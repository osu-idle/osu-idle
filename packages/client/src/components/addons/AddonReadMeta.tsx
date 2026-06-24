import { Trans } from '@lingui/react/macro';
import AddonIcon from './AddonIcon';
import type { AddonDetail } from './AddonView';

/** Read-only left column of the add-on view (details / update / install). */
export default function AddonReadMeta({ detail }: { detail: AddonDetail }) {
	return (
		<>
			<div className='addon-view__head'>
				<AddonIcon icon={detail.icon} name={detail.name} />
				<div className='addon-view__headmeta'>
					<div className='addon-view__name'>
						{detail.name}<span className='addon__ver'>v{detail.version}</span>
					</div>
					<div className='addon__by'>
						<Trans>by {detail.authorName} for game version {detail.gameVersion}</Trans>
					</div>
				</div>
			</div>
			{detail.tags.length > 0 && <div className='addon__tags'>
				{detail.tags.map(t => <span key={t} className='addon__tag'>{t}</span>)}
			</div>}
			{detail.description && <p className='addon-view__desc'>{detail.description}</p>}
		</>
	);
}
