import { useRef, useState, type ReactNode } from 'react';

/** How long the armed "click again" state lasts before reverting. */
const CONFIRM_MS = 3000;

type Props = {
	label: ReactNode,
	/** Shown after the first click; a second click within {@link CONFIRM_MS} confirms. */
	armedLabel: ReactNode,
	onConfirm: () => void,
	className?: string,
	disabled?: boolean,
};

/** osu!-style two-click confirm button (see DeleteAllBeatmaps / the card menu). */
export default function ArmedButton({ label, armedLabel, onConfirm, className, disabled }: Props) {
	const [armed, setArmed] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const click = () => {
		if (!armed) {
			setArmed(true);
			timer.current = setTimeout(() => setArmed(false), CONFIRM_MS);
			return;
		}
		clearTimeout(timer.current);
		setArmed(false);
		onConfirm();
	};

	return (
		<button type='button' className={className} disabled={disabled} onClick={click}>
			{armed ? armedLabel : label}
		</button>
	);
}
