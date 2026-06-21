import { useEffect } from 'react';
import { logout } from '../api/logout';
import { navigate, ROUTE } from '../router';
import { refreshCurrentUser } from '../hooks/useCurrentUser';
import { Trans } from '@lingui/react/macro';

export default function Logout() {
	useEffect(() => {
		logout().then(() => {
			// The session cookie is gone; refresh our own view and ping the same-origin
			// game client (and any other tab) so it re-resolves and drops to guest too -
			// the client and web session must never disagree on who's signed in.
			void refreshCurrentUser();
			try { localStorage.setItem('osu-idle:auth', String(Date.now())); } catch { /* ignore */ }
			navigate(ROUTE.HOME, true);
		});
	}, []);

	return (<>
		<main className="page-contents">
			<Trans>See you later!</Trans>
		</main>
	</>);
}
