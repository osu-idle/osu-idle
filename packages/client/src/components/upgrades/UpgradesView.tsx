import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	UPGRADE_LEVELS,
	UPGRADE_XP_BONUS,
} from '@osu-idle/shared/upgrades';
import Entities from '../../entity/entities';
import UpgradeRow from './UpgradeRow';

export default function UpgradesView() {
	const [character] = useSynced(Entities.character);
	const bonus = Math.round(UPGRADE_XP_BONUS * 100);

	return (
		<div className="upgrades">
			<p className="upgrades__hint">
				<Trans>
					An upgrade costs {UPGRADE_LEVELS} raw levels of the skill and
					permanently boosts its XP gains by {bonus}%. Buying above the required
					level spends more XP and feeds Overdrive, which multiplies the boost.
				</Trans>
			</p>
			<div className="upgrades__list">
				{character.skills.map(skill => (
					<UpgradeRow
						key={`${character.id}:${skill.name}`}
						skill={skill}
						locked={character.id === 0}
					/>
				))}
			</div>
		</div>
	);
}
