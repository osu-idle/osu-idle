import './AuthCallback.css';

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { pageTitle } from '../globals';
import { Trans } from '@lingui/react/macro';
import PlayOsuIdle from './PlayOsuIdle';

/** osu! → API → here. The API already set the session cookie; this page just
 * notifies the game (same-origin localStorage ping) and closes the popup. */
export default function AuthCallback() {
	const navigate = useNavigate();
	useEffect(() => {
		try {
			localStorage.setItem('osu-idle:auth', String(Date.now()));
		} catch {
			void navigate({ to: '/auth/error' });
			return;
		}

		// In-game flow opens this as a popup → close it. The top-level landing
		// flow runs in the tab itself → drop the player into the game (origin
		// root), now signed in.
		if (window.opener && window.opener !== window) {
			window.close();
		}
        
	}, []);

	const user = useCurrentUser();

	pageTitle.set(user ? 'Login' : 'one moment...');

	return (
		<main className="page-contents">
			<div className="page-text">
				{user && (<>
					<h1 className='center'><Trans>Hello {user.username}!</Trans></h1>
                    
					<PlayOsuIdle />
				</>)}
			</div>
		</main>
	);
}