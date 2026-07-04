import useSynced from '@osu-idle/shared/hooks/useSynced';
import './Alpha.css';
import { Trans } from '@lingui/react/macro';
import { showUsers } from './community/state';
import SceneManager, { SCENE } from '../scenes/SceneManager';
import {
	displayAlpha,
	isCommunityOpen,
	openPage,
} from '../globals';

export default function Alpha() {
	const [alpha] = useSynced(displayAlpha);
	const [users] = useSynced(showUsers);
	const [community] = useSynced(isCommunityOpen);
	const [page] = useSynced(openPage);

	SceneManager.current.use(scene => {


		switch(scene) {
			case SCENE.INTRO:
			case SCENE.GAME:
			case SCENE.RESULT:
			case SCENE.SELECT:
				displayAlpha.set(false);
				return;
			default:
				displayAlpha.set(true);
		}
	});

	if (!alpha || page || (users && community)) return null;
	
	return (
		<div className='alpha__warning'>
			<div className='alpha__border'></div>
			<div className='alpha__text'>
				<Trans>osu!idle is in <b>early alpha</b>: report bugs on <a href="https://discord.gg/Yd5GEaX8AJ" target='_blank'>discord</a> or <a href="https://github.com/osu-idle/osu-idle" target='_blank'>github</a></Trans>
			</div>
		</div>
	);
}