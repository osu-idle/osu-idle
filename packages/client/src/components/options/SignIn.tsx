import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Auth from '../../online/auth';
import Button from './controls/Button';
import { isWebOpen, webUrl } from '../../globals';

/**
 * Shows who's signed in (with a sign-out button) or, signed out, a button that
 * opens the in-game browser on the login page. The session itself lives in the
 * shared cookie - see online/account.ts.
 */
export default function SignIn() {
	const [user] = useSynced(Auth.user);

	if (user) {
		return (
			<div className="opt-signin">
				<span className="opt-signin__who">
					<Trans>Signed in as {user.username}</Trans>
				</span>
				<Button label={<Trans>Sign out</Trans>} accent="#6b7178" onClick={() => void Auth.signOut()} />
			</div>
		);
	}

	const openLogin = () => {
		void webUrl.set('login');
		void isWebOpen.set(true);
	};

	return <Button label={<Trans>Sign in</Trans>} onClick={openLogin} />;
}
