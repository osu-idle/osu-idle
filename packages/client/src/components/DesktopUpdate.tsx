import './DesktopUpdate.css';
import {
	useEffect,
	useState,
	type ReactNode,
} from 'react';
import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	checkForDesktopUpdate,
	downloadDesktopUpdate,
	updateStatus,
} from '../online/desktopUpdate';

/**
 * Desktop-only banner that surfaces an available app update and walks
 * the player through it: download, then restart into the new version.
 *
 * Mounted once from App  renders nothing in the browser
 * (the status never leaves `idle` there) or while there's nothing to act on.
 */
export default function DesktopUpdate() {
	const [status] = useSynced(updateStatus);
	const [dismissed, setDismissed] = useState(false);

	// a fresh availability / readiness / error re-opens the banner after a dismiss
	useEffect(() => { setDismissed(false); }, [status.state]);

	// content + the optional primary action, by state; dismissable states get the
	// close button. Anything else (idle / checking / none) shows no banner.
	let body: ReactNode = null;
	const action: ReactNode = null;
	let onClick = () => {};

	switch (status.state) {
		case 'available':
			body = <span>
				<Trans>A new update is available. Click here to download it !</Trans>
			</span>;
			onClick = downloadDesktopUpdate;
			break;
		case 'downloading':
			body = <>
				<div className="dupdate__bar-fill" style={{ width: `${status.percent}%` }} />
				<span><Trans>Downloading update…</Trans></span>
			</>;
			break;
		case 'error':
			body = <span className="dupdate__error">
				<Trans>Update failed ({status.message}). Please restart the game.</Trans>
			</span>;
			onClick = checkForDesktopUpdate;
			break;
	}

	if (!body || dismissed) return null;

	return (
		<div className={`dupdate ${status.state}`} onClick={onClick}>
			{body}
			{action}
		</div>
	);
}
