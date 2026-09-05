import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	DEBUG_XP_STEPS,
	debugXpMultiplier,
} from '../../globals';

/**
 * Debug-only: cycle the xp a play awards through x1 / x10 / x100 / x1000, so the
 * long progression thresholds are reachable while testing. Applies to local and
 * ranked plays alike - the server scales the play as it stores it - and the
 * server pins it back to x1 outside development.
 */
export default function XpMultiplierToggle() {
	const [multiplier] = useSynced(debugXpMultiplier);

	const cycle = () => {
		const next = DEBUG_XP_STEPS[(DEBUG_XP_STEPS.indexOf(
			multiplier as typeof DEBUG_XP_STEPS[number],
		) + 1) % DEBUG_XP_STEPS.length];
		void debugXpMultiplier.set(next ?? 1);
	};

	return (
		<button
			className={`game__debug-btn game__xp-btn ${multiplier > 1 ? 'is-boosted' : ''}`}
			onClick={cycle}
			title="Debug XP multiplier"
		>
			{`x${multiplier}`}
		</button>
	);
}
