import './EditableProfilePicture.css';
import { useRef, useState } from 'react';
import ProfilePicture from './ProfilePicture';
import { resetAvatar, uploadAvatar } from '../api/users';
import { Trans, useLingui } from '@lingui/react/macro';

type Props = {
	avatarUrl?: string | null;
	className?: string;
	/** Called with the account's new avatar URL after an upload or reset. */
	onChange?: (avatarUrl: string | null) => void;
};

/**
 * The signed-in player's own avatar: click to upload a custom profile picture,
 * or reset it back to the osu! default. Shown in place of a plain
 * {@link ProfilePicture} when the viewer is looking at their own character.
 */
export default function EditableProfilePicture({ avatarUrl, className, onChange }: Props) {
	const { t } = useLingui();

	const fileInput = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const run = async (action: () => Promise<{ avatarUrl: string | null }>) => {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			onChange?.((await action()).avatarUrl);
		} catch (e) {
			setError(String((e as Error).message ?? e));
		} finally {
			setBusy(false);
		}
	};

	const pick = (file: File | undefined) => { if (file) void run(() => uploadAvatar(file)); };

	return (
		<div className={`editable-avatar ${className ?? ''}`}>
			<button
				type="button"
				className="editable-avatar__btn"
				onClick={() => fileInput.current?.click()}
				disabled={busy}
				title={t`Upload a profile picture`}
			>
				<ProfilePicture avatarUrl={avatarUrl} className="editable-avatar__img" />
				<span className="editable-avatar__overlay">{busy ? '…' : 'Change'}</span>
			</button>
			<button
				type="button"
				className="editable-avatar__reset"
				onClick={() => void run(resetAvatar)}
				disabled={busy}
			>
				<Trans>Reset to osu! avatar</Trans>
			</button>
			{error && <span className="editable-avatar__error">{error}</span>}
			<input
				ref={fileInput}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				hidden
				onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }}
			/>
		</div>
	);
}
