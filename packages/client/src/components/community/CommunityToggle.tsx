import useSynced from '@osu-idle/shared/hooks/useSynced';
import type Synced from '@osu-idle/shared/helpers/synced';

/** A bottom-right toggle button backed by a boolean Synced (a persisted Setting). */
export default function CommunityToggle({
	value, label, onClick,
}: { value: Synced<boolean>; label: string; onClick?: () => void }) {
	const [on] = useSynced(value);
	return (
		<button
			className="community-controls__btn"
			data-on={on}
			onClick={() => {
				if (onClick) {
					onClick?.();
				} else {
					value.set(!value.get());
				}
			}}
		>{label}</button>
	);
}
