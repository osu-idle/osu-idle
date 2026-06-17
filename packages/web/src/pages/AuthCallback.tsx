import './AuthCallback.css';

import { useEffect } from 'react';
import { navigate, ROUTE } from '../router';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { pageTitle } from '../globals';

/** osu! → API → here. The API already set the session cookie; this page just
 * notifies the game (same-origin localStorage ping) and closes the popup. */
export default function AuthCallback() {
	useEffect(() => {
		try {
			localStorage.setItem('osu-idle:auth', String(Date.now()));
		} catch {
			navigate(ROUTE.AUTH_ERROR);
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
					<h1 className='center'>Hello {user.username}!</h1>
                    
					{/* New CTA Button */}
					<div className='center' style={{ marginTop: '30px' }}>
						<a href='/' className='cta-button'>
							<span>Start Game</span>
						</a>
					</div>
				</>)}
			</div>
		</main>
	);
}