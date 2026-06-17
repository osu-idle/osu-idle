import './Alpha.css';
import { Trans } from '@lingui/react/macro';

export default function Alpha() {
	return (
		<div className='alpha__warning'>
			<div className='alpha__border'></div>
			<div className='alpha__text'>
				<Trans>osu!idle is in <b>early alpha</b>: report bugs on <a href="https://discord.gg/Yd5GEaX8AJ" target='_blank'>discord</a></Trans>
			</div>
		</div>
	);
}