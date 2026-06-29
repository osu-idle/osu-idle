import './CommunityControls.css';
import { useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { isCommunityOpen } from '../../globals';
import CommunityToggle from './CommunityToggle';
import {
	autoHide,
	showChat,
	showTicker,
	showUsers,
} from './state';

/**
 * The bottom-right control strip, present open or closed. Mirrors osu!stable's
 * chat buttons: ticker / auto-hide / online-users toggles plus show-hide chat.
 */
export default function CommunityControls() {
	const { t } = useLingui();
	const [open] = useSynced(isCommunityOpen);
	const [chat] = useSynced(showChat);

	return (
		<div className="community-controls">
			{open && (<>
				<CommunityToggle value={showTicker} label={t`Show ticker`} />
				<CommunityToggle value={autoHide} label={t`Auto-hide`} />
			</>)}
			<CommunityToggle 
				value={showUsers}
				label={t`Online users`} 
				onClick={() => {
					const current = showUsers.get();
					const isOpen = isCommunityOpen.get();
					// if overlay is open and state is on, only set to false
					if (isOpen) {
						showUsers.set(!current);
						return;
					}
					// if overlay is closed and state is off, open everything
					if (!isOpen && !current) {
						isCommunityOpen.set(true);
						showChat.set(true);
						showUsers.set(true);
					}
				}}
			/>
			<CommunityToggle
				value={showChat}
				label={chat ? t`Hide chat` : t`Show chat`}
				onClick={() => {
					const isOpen = isCommunityOpen.get();
					isCommunityOpen.set(!isOpen);
					showChat.set(!isOpen);
					if (isOpen) {
						showUsers.set(false);
					}
				}}
			/>
		</div>
	);
}
