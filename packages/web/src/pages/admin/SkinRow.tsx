import {
	SKIN_STATUS,
	type SkinStatus,
} from '@osu-idle/shared/skin';
import {
	skinIconUrl,
	type AdminSkin,
} from '../../api/skins';

const fmt = (iso: string | null): string =>
	iso ? new Date(iso).toLocaleString(undefined, {
		dateStyle: 'medium', timeStyle: 'short', 
	}) : '—';

export default function SkinRow({ row, busy, onModerate }: {
	row: AdminSkin;
	busy: boolean;
	onModerate: (id: number, body: { status: SkinStatus; }) => void;
}) {

	const moderate = (status: SkinStatus) => onModerate(row.id, { status });
	const icon = skinIconUrl(row.icon);

	return (
		<div className='skins-admin__entry'>
			<div className='skins-admin__info'>
				{icon
					? <img className='skins-admin__cover' src={icon} alt='' />
					: <div className='skins-admin__cover skins-admin__cover--empty' />}
				<div className='skins-admin__meta'>
					<span className='skins-admin__title'>
						{row.name} <span className='skins-admin__ver'>v{row.version}</span>
					</span>
					<span className='skins-admin__creator'>by {row.authorName}</span>
					{row.tags.length > 0 && <span className='skins-admin__tags'>{row.tags.join(', ')}</span>}
				</div>

				<span className={`skins-admin__badge skins-admin__badge--${row.status}`}>{row.status}</span>

				<div className='skins-admin__stat'>
					<span className='skins-admin__label'>Submitted</span><span>{fmt(row.updatedAt)}</span>
				</div>
				<div className='skins-admin__stat'>
					<span className='skins-admin__label'>Published</span><span>{fmt(row.publishedAt)}</span>
				</div>
			</div>

			{row.description && <p className='skins-admin__desc'>{row.description}</p>}

			<div className='skins-admin__actions'>
				{row.status !== SKIN_STATUS.PUBLISHED && (
					<button 
						className='skins-admin__btn skins-admin__btn--primary' 
						disabled={busy} 
						onClick={() => moderate(SKIN_STATUS.PUBLISHED)}
					>
						Approve
					</button>
				)}
				{row.status === SKIN_STATUS.PUBLISHED && (
					<button 
						className='skins-admin__btn skins-admin__btn--warn'
						disabled={busy} 
						onClick={() => moderate(SKIN_STATUS.UNPUBLISHED)}
					>
						Unpublish
					</button>
				)}
			</div>
		</div>
	);
}
