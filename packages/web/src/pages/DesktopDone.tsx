import { useEffect } from 'react';
import './DesktopDone.css';
import { Trans } from '@lingui/react/macro';

/**
 * Shown in the system browser after the desktop OAuth round-trip. The app polls
 * the server for the session itself, so there's nothing to redeem here - the
 * "Return" button is an `osu-idle://` deep link whose click (a user gesture) the
 * OS honours to bring the app forward (an automatic redirect to a custom scheme
 * is blocked by some browsers).
 */
export default function DesktopDone() {

	useEffect(() => {
		window.location.href = 'osu-idle://focus';

		setTimeout(() => window.close(), 30000);
	}, []);

	return (
		<main className="page-contents desktop-done">
			<h1 className="center"><Trans>You're signed in!</Trans></h1>
			<p className="center"><Trans>Back in osu!idle already? You can close this tab.</Trans></p>
			<a className="cta-button" href="osu-idle://focus"><Trans>Return to osu!idle</Trans></a>
		</main>
	);
}
