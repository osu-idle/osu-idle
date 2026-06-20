import './Onboarding.css';
import { useEffect, useRef, useState } from 'react';
import Auth from '../online/auth';
import Account from '../online/account';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';

/**
 * First-login onboarding. Shown once when signed in but the account has no
 * character yet: name the character (default = osu! username). The account
 * always starts fresh - local Guest progress is no longer migrated online.
 */
export default function Onboarding() {
	const [needs] = useSynced(Account.needsOnboarding);
	const [user] = useSynced(Auth.user);
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	// Prefill the name with the osu! username once it's known.
	useEffect(() => { if (user) setName(user.username); }, [user]);

	if (!needs || !user) return null;

	const pickAvatar = async (file: File | undefined) => {
		if (!file || uploading) return;
		setUploading(true);
		setError(null);
		try {
			await Auth.uploadAvatar(file);
		} catch (e) {
			setError(String(e));
		} finally {
			setUploading(false);
		}
	};

	const submit = async () => {
		if (!name.trim() || busy) return;
		setBusy(true);
		setError(null);
		try {
			await Account.complete({ name: name.trim() });
		} catch (e) {
			setError(String(e));
			setBusy(false);
		}
	};

	return (
		<div className="onboard">
			<div className="onboard__card">
				<h1 className="onboard__title">Welcome, {user.username}!</h1>
				<p className="onboard__sub">Create your character to finish setting up your account.</p>

				<div className="onboard__avatar-field">
					<button
						type="button"
						className="onboard__avatar"
						onClick={() => fileInput.current?.click()}
						disabled={uploading}
						title="Upload a profile picture"
					>
						<img className="onboard__avatar-img" src={user.avatarUrl ?? GUEST_AVATAR_URL} alt="" />
						<span className="onboard__avatar-overlay">{uploading ? 'Uploading…' : 'Change'}</span>
					</button>
					<span className="onboard__avatar-hint">Profile picture<br />Defaults to your osu! avatar</span>
					<input
						ref={fileInput}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/gif"
						hidden
						onChange={e => { void pickAvatar(e.target.files?.[0]); e.target.value = ''; }}
					/>
				</div>

				<label className="onboard__field">
					<span className="onboard__label">Character name</span>
					<input
						className="onboard__input"
						value={name}
						onChange={e => setName(e.target.value)}
						maxLength={32}
						disabled={busy}
						autoFocus
					/>
				</label>

				{error && <p className="onboard__error">{error}</p>}

				<div className="onboard__actions">
					<button
						className="onboard__btn onboard__btn--primary"
						disabled={busy || !name.trim()}
						onClick={submit}
					>
						Create character
					</button>
				</div>
			</div>
		</div>
	);
}
