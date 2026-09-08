import { useState } from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart } from '@fortawesome/free-solid-svg-icons';
import { dateAgo } from '@osu-idle/shared/display/ago';
import type { MapRequest } from '../../api/mapRequests';
import OutLink from '../../components/OutLink';
import ProfilePicture from '../../components/ProfilePicture';
import {
	PHASE_LABEL,
	phaseOf,
} from './requestPhase';

export default function RequestRow({
	row, mine, admin, busy, onSupport, onResolve, onIngest, onDelete,
}: {
	row: MapRequest,
	mine: boolean,
	admin: boolean,
	busy: boolean,
	onSupport: (setId: number) => void,
	onResolve: (setId: number, status: 'accepted' | 'rejected', note?: string) => void,
	onIngest: (setId: number) => void,
	onDelete: (setId: number) => void,
}) {
	const { t, i18n } = useLingui();
	const [note, setNote] = useState('');

	const phase = phaseOf(row);
	const open = phase === 'open';

	return (
		<div className={`request request--${phase}`}>
			<div
				className='request__cover'
				style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${row.setId}/covers/list.jpg')` }}
			/>

			<div className='request__meta'>
				<OutLink
					className='request__title'
					href={`https://osu.ppy.sh/beatmapsets/${row.setId}`}
					target='_blank'
				>
					{row.title}
				</OutLink>
				<span className='request__artist'>{row.artist}</span>
				<span className='request__creator'><Trans>mapped by {row.creator}</Trans></span>
				<div className='request__bottom'>
					<span className={`request__capsule request__capsule--${phase}`}>
						{i18n._(PHASE_LABEL[phase])}
					</span>
					<span className='request__ago'>{dateAgo(row.createdAt)}</span>
				</div>
				{row.note && <p className='request__note'>{row.note}</p>}
			</div>

			<div className='request__requester'>
				<ProfilePicture avatarUrl={row.avatarUrl} className='request__avatar' />
				<span className='request__username'>{row.username}</span>
			</div>

			<button
				className={`request__support ${row.supported ? 'is-supported' : ''}`}
				disabled={busy || !open}
				title={open
					? (row.supported ? t`Remove your support` : t`Support this request`)
					: t`This request has been answered`}
				onClick={() => onSupport(row.setId)}
			>
				<FontAwesomeIcon icon={faHeart} />
				<span>{row.support}</span>
			</button>

			{(admin || (mine && open)) && (
				<div className='request__actions'>
					{admin && open && <>
						<input
							className='request__field'
							value={note}
							disabled={busy}
							placeholder={t`reason (optional)`}
							onChange={e => setNote(e.target.value)}
						/>
						<button
							className='request__btn request__btn--primary'
							disabled={busy}
							title={t`Download the .osz and push it into the nomination queue`}
							onClick={() => onIngest(row.setId)}
						>
							<Trans>Ingest</Trans>
						</button>
						<button
							className='request__btn'
							disabled={busy}
							onClick={() => onResolve(row.setId, 'accepted', note || undefined)}
						>
							<Trans>Accept</Trans>
						</button>
						<button
							className='request__btn request__btn--warn'
							disabled={busy}
							onClick={() => onResolve(row.setId, 'rejected', note || undefined)}
						>
							<Trans>Reject</Trans>
						</button>
					</>}
					<button
						className='request__btn request__btn--danger'
						disabled={busy}
						onClick={() => onDelete(row.setId)}
					>
						{mine && !admin ? <Trans>Withdraw</Trans> : <Trans>Delete</Trans>}
					</button>
				</div>
			)}
		</div>
	);
}
