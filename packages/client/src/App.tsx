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

Spectate.start();
Presence.start();

export default function App() {
	const [scene] = useSynced(SceneManager.scene);
	const [alpha] = useSynced(SceneManager.displayAlpha);

	return (
		<>
			{alpha && <Alpha />}
			{scene}
			<TransitionOverlay />
			<VolumeOverlay />
			<Onboarding />
			<Tutorial />
			<Message />
			<Options />
			<WebBrowser />
			<Popups />
			<FpsCounter />
			{!isMobile && <Cursor />}
		</>
	);
}
