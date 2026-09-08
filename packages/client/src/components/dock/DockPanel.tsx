import DockControls from './DockControls';
import DockNowPlaying from './DockNowPlaying';
import DockQueue from './DockQueue';

type Props = {
	onCollapse?: () => void;
	/** docked to the left column while the queue carousel is open */
	left?: boolean;
	/** that carousel is song select itself, which keeps its bottom bar */
	inScene?: boolean;
	/** the scene under it has a bottom bar to stay clear of */
	aboveBar?: boolean;
};

/** The dock, open: what is playing, what plays next, and the controls that used
 *  to need a scene. The same panel wherever it is - only where it sits changes. */
export default function DockPanel({
	onCollapse,
	left = false,
	inScene = false,
	aboveBar = false,
}: Props) {
	return (
		<div className={[
			'dock',
			'dock--panel',
			left ? 'dock--left' : '',
			left && inScene ? 'dock--left-scene' : '',
			!left && aboveBar ? 'dock--above-bar' : '',
		].join(' ')}>
			<DockNowPlaying />
			<DockControls left={left} onCollapse={onCollapse} />
			<DockQueue hint={left} />
		</div>
	);
}
