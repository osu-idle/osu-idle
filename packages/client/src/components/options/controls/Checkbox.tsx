import { ReactNode } from 'react';
import Synced from '@osu-idle/shared/helpers/synced';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import './Checkbox.css';

interface Props {
	/** Backing flag. Pass a shared `Synced` so the toggle stays subscribable. */
	value: Synced<boolean>;
	label: ReactNode;
	/**
	 * Fired synchronously inside the click handler with the next value, *before*
	 * `value` is committed - the place to do anything that needs the user-gesture
	 * stack still live (e.g. `requestFullscreen`).
	 */
	onChange?: (next: boolean) => void;
}

/**
 * osu!-style settings checkbox: a full-width clickable row with the label on the
 * left and a tick box on the right. Backed by a `Synced<boolean>` so the state
 * is subscribable outside the panel.
 */
export default function Checkbox({ value, label, onChange }: Props) {
	const [checked] = useSynced(value);

	const toggle = () => {
		const next = !checked;
		onChange?.(next);
		void value.set(next);
	};

	return (
		<button type="button" className={`opt-checkbox ${checked ? 'is-on' : ''}`} onClick={toggle}>
			<span className="opt-checkbox__box" aria-hidden>
				<span className="opt-checkbox__tick" />
			</span>
			<span className="opt-checkbox__label">{label}</span>
		</button>
	);
}
