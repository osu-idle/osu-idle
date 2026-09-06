import { Trans } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { PRESTIGE_MIN_LEVEL } from '@osu-idle/shared/upgrades';
import Entities from '../../entity/entities';
import PrestigeRow from './PrestigeRow';

export default function PrestigeView() {
	const [character] = useSynced(Entities.character);

	return (
		<div className="upgrades">
			<p className="upgrades__hint">
				<Trans>
					Reaching XP Lv{PRESTIGE_MIN_LEVEL} on a skill lets you reset it. You
					lose its upgrades and Overdrive, and gain a permanent bonus level, an
					extra gear slot and a multiplicative XP bonus. Each prestige asks for
					one more level than the last.
				</Trans>
			</p>
			<div className="upgrades__list">
				{character.skills.map(skill => (
					<PrestigeRow
						key={`${character.id}:${skill.name}`}
						skill={skill}
						locked={character.id === 0}
						lifetimeXp={character[`${skill.name}LifetimeXp`]}
					/>
				))}
			</div>
		</div>
	);
}
