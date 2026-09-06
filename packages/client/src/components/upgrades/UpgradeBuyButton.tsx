import {
	Plural,
	Trans,
} from '@lingui/react/macro';
import useShiftHeld from '@osu-idle/shared/hooks/useShiftHeld';

/**
 * The buy control of an upgrade row. Shift skips the confirm and purchases
 * straight away, so while shift is held the button says so and changes colour
 * rather than surprising the player after the click.
 */
export default function UpgradeBuyButton({
	maxed,
	purchasable,
	busy,
	cost,
	minLevel,
	onBuy,
	onConfirm,
}: {
	maxed: boolean,
	purchasable: boolean,
	busy: boolean,
	cost: number,
	minLevel: number,
	onBuy: () => void,
	onConfirm: () => void,
}) {
	const instant = useShiftHeld();

	const label = () => {
		if (maxed) return <Trans>Maxed</Trans>;
		if (!purchasable) return <Trans>Requires XP Lv{minLevel}</Trans>;
		if (instant) return <Trans>Buy</Trans>;
		return <Trans>Buy for <Plural value={cost} one="# level" other="# levels" /></Trans>;
	};

	return (
		<button
			className={`upgrade__buy ${instant ? 'is-instant' : ''}`}
			disabled={!purchasable || busy}
			onClick={(e) => (e.shiftKey ? onBuy() : onConfirm())}
		>
			{label()}
		</button>
	);
}
