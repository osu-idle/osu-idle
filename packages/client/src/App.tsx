import Popups from './components/Popups';
import Cursor from './components/Cursor';
import SceneManager from './scenes/SceneManager';
import TransitionOverlay from './scenes/Transition';
import VolumeOverlay from './components/VolumeOverlay';
import WebBrowser from './components/WebBrowser';
import Onboarding from './components/Onboarding';
import Tutorial from './components/Tutorial';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { isMobile } from './globals';
import Message from './components/Message';
import Options from './scenes/Options';
import FpsCounter from './components/FpsCounter';
import PlayManager from './online/playManager';
import Presence from './online/presence';
import Socket from './online/socket';
import CommunityOverlay from './components/community/CommunityOverlay';
import PageOverlay from './components/page/PageOverlay';
import PlayDock from './components/dock/PlayDock';
import Playground from './dev/Playground';
import FloatingDeltas from './components/FloatingDeltas';
import './online/versionWatch';
import './online/characterWatch';

PlayManager.start();
Presence.start();
Socket.start();

/** Dev-only component bench; see dev/Playground.tsx. Checked once at load so a
 *  production build drops the whole tree. */
const playground = import.meta.env.DEV
	&& new URLSearchParams(location.search).has('playground');

export default function App() {
	const [scene] = useSynced(SceneManager.scene);

	if (playground) return <Playground />;

	return (
		<>
			{scene}
			<PageOverlay />
			<PlayDock />
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
