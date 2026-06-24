import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import Auth from '../../online/auth';
import Button from './controls/Button';

/**
 * Shows who's signed in (with a sign-out button) or, signed out, a button that
 * starts sign-in (native flow on desktop, in-game browser otherwise - see
 * {@link Auth.signIn}). The session itself lives in the shared cookie / bridge
 * token - see online/account.ts.
 */
export default function SignIn() {
	const [user] = useSynced(Auth.user);

	if (user) {
		return (
			<div className="opt-signin">
				<span className="opt-signin__who">
					<Trans>Signed in as {user.username}</Trans>
				</span>
				<Button 
					label={<Trans>Sign out</Trans>} 
					accent="#6b7178" 
					onClick={() => void Auth.signOut()} 
				/>
			</div>
		);
	}

	return <Button label={<Trans>Sign in</Trans>} onClick={() => Auth.signIn()} />;
}
