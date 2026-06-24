import { Trans } from '@lingui/react/macro';
import { SkinCreateBody } from '@osu-idle/shared/skin';
import { Skin } from '../../online/skins';
import SkinIcon from './SkinIcon';

export default function SkinReadMeta({ skin }: { skin: Skin | SkinCreateBody }) {
	return (
		<>
			<div className='skin-view__head'>
				<SkinIcon icon={skin.icon} name={skin.name} />
				<div className='skin-view__headmeta'>
					<div className='skin-view__name'>
						{skin.name}<span className='skin__ver'>v{skin.version}</span>
					</div>
					{'authorName' in skin && (
						<div className='skin__by'>
							<Trans>by {skin.authorName}</Trans>
						</div>
					)}
				</div>
			</div>
			{skin.tags.length > 0 && <div className='skin__tags'>
				{skin.tags.map(t => <span key={t} className='skin__tag'>{t}</span>)}
			</div>}
			{skin.description && <p className='skin-view__desc'>{skin.description}</p>}
		</>
	);
}
