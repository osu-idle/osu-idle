import Popups from './components/Popups';
import Cursor from './components/Cursor';
import SceneManager from './scenes/SceneManager';
import TransitionOverlay from './scenes/Transition';
import Alpha from './components/Alpha';
import VolumeOverlay from './components/VolumeOverlay';
import WebBrowser from './components/WebBrowser';
import Onboarding from './components/Onboarding';
import Tutorial from './components/Tutorial';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { isMobile } from './globals';
import Message from './components/Message';
import Options from './scenes/Options';
import FpsCounter from './components/FpsCounter';
import Spectate from './online/spectate';
import Presence from './online/presence';
import Socket from './online/socket';
import CommunityOverlay from './components/community/CommunityOverlay';
import PageOverlay from './components/page/PageOverlay';
import FloatingDeltas from './components/FloatingDeltas';
import './online/versionWatch';

Spectate.start();
Presence.start();
Socket.start();

export default function App() {
	const [scene] = useSynced(SceneManager.scene);

	return (
		<>
			<Alpha />
			{scene}
			<PageOverlay />
			<TransitionOverlay />
			<VolumeOverlay />
			<Onboarding />
			<Tutorial />
			<Message />
			<Options />
			<WebBrowser />
			<CommunityOverlay />
			<FloatingDeltas />
			<Popups />
			<FpsCounter />
			{!isMobile && <Cursor />}
		</>
	);
}
