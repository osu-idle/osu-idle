import './Blackout.css';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { blackout } from '../globals';

/** The shared dimming overlay element. The `Blackout` controller lives in
 *  globals; this just renders its current state and dismisses it on click. */
export default function BlackoutOverlay() {
	const [active] = useSynced(blackout.active);

	return (<div 
		className={`__blackout ${active ? 'visible' : 'hidden'}`} 
		onClick={() => blackout.close()}
	>
	</div>);
}
