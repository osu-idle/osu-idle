import { useState } from 'react';
import Prism from 'prismjs';
import 'prism-themes/themes/prism-vsc-dark-plus.css';
import { ADDON_STATUS, type AddonStatus } from '@osu-idle/shared/addon';
import { addonIconUrl, type AdminAddon } from '../../api/addons';

const fmt = (iso: string | null): string =>
	iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AddonRow({ row, busy, onModerate }: {
	row: AdminAddon;
	busy: boolean;
	onModerate: (id: number, body: { status: AddonStatus; feedback?: string | null }) => void;
}) {
	const [feedback, setFeedback] = useState(row.feedback ?? '');
	const [showCode, setShowCode] = useState(false);

	const moderate = (status: AddonStatus) => onModerate(row.id, { status, feedback: feedback.trim() || null });
	// Feedback without a verdict parks a reviewed add-on on hold; a published one
	// stays published (the admin is just leaving a note).
	const sendFeedback = () => moderate(row.status === ADDON_STATUS.published ? ADDON_STATUS.published : ADDON_STATUS.onHold);
	const icon = addonIconUrl(row.icon);

	return (
		<div className='addons-admin__entry'>
			<div className='addons-admin__info'>
				{icon
					? <img className='addons-admin__cover' src={icon} alt='' />
					: <div className='addons-admin__cover addons-admin__cover--empty' />}
				<div className='addons-admin__meta'>
					<span className='addons-admin__title'>{row.name} <span className='addons-admin__ver'>v{row.version}</span></span>
					<span className='addons-admin__creator'>by {row.authorName} · game v{row.gameVersion}</span>
					{row.tags.length > 0 && <span className='addons-admin__tags'>{row.tags.join(', ')}</span>}
				</div>

				<span className={`addons-admin__badge addons-admin__badge--${row.status}`}>{row.status}</span>

				<div className='addons-admin__stat'><span className='addons-admin__label'>Submitted</span><span>{fmt(row.updatedAt)}</span></div>
				<div className='addons-admin__stat'><span className='addons-admin__label'>Published</span><span>{fmt(row.publishedAt)}</span></div>
			</div>

			{row.description && <p className='addons-admin__desc'>{row.description}</p>}

			<button className='addons-admin__btn' onClick={() => setShowCode(s => !s)}>{showCode ? 'Hide code' : 'View code'}</button>
			{showCode && (
				<pre className='language-javascript addons-admin__code'>
					<code
						className='language-javascript'
						dangerouslySetInnerHTML={{ __html: Prism.highlight(row.source, Prism.languages.javascript, 'javascript') }}
					/>
				</pre>
			)}

			<textarea
				className='addons-admin__feedback'
				placeholder='Feedback (shown to the author)'
				value={feedback}
				disabled={busy}
				onChange={e => setFeedback(e.target.value)}
			/>

			<div className='addons-admin__actions'>
				<button className='addons-admin__btn' disabled={busy} onClick={sendFeedback}>Send feedback</button>
				{row.status !== ADDON_STATUS.published && (
					<button className='addons-admin__btn addons-admin__btn--primary' disabled={busy} onClick={() => moderate(ADDON_STATUS.published)}>Approve</button>
				)}
				{(row.status === ADDON_STATUS.pending || row.status === ADDON_STATUS.onHold) && (
					<button className='addons-admin__btn addons-admin__btn--warn' disabled={busy} onClick={() => moderate(ADDON_STATUS.denied)}>Deny</button>
				)}
				{row.status === ADDON_STATUS.published && (
					<button className='addons-admin__btn addons-admin__btn--warn' disabled={busy} onClick={() => moderate(ADDON_STATUS.unpublished)}>Unpublish</button>
				)}
			</div>
		</div>
	);
}
