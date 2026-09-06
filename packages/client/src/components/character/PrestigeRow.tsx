import { useState } from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import type Skill from '@osu-idle/shared/sim/skills/skill';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { skillName } from '@osu-idle/shared/display/skills';
import {
	canPrestige,
	maxUpgrades,
	prestigeMinLevel,
	prestigeXPMultiplier,
} from '@osu-idle/shared/upgrades';
import SkillLevel from '@osu-idle/shared/display/SkillLevel';
import ConfirmMenu, { type Confirm } from '../ConfirmMenu';
import { prestigeSkill } from '../../online/services/prestige';

export default function PrestigeRow({
	skill,
	locked,
	lifetimeXp,
}: {
	skill: Skill,
	locked: boolean,
	/** xp ever earned on the skill, shown as a level behind it on hover */
	lifetimeXp?: number,
}) {
	const { t } = useLingui();
	const [level] = useSynced(skill.level);
	const [xp] = useSynced(skill.xp);
	const [prestige] = useSynced(skill.prestige);
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState<Confirm | undefined>(undefined);

	const required = prestigeMinLevel(prestige);
	const ready = !locked && canPrestige({
		level, prestige,
	});
	const multiplier = prestigeXPMultiplier(prestige);
	const next = prestigeXPMultiplier(prestige + 1);

	const run = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await prestigeSkill(skill.name);
		} finally {
			setBusy(false);
		}
	};

	const confirm = () => {
		if (!ready || busy) return;
		const name = skillName(skill.name);
		setConfirming({
			title: t`Prestige ${name}?`,
			sub: t`XP Lv${level} → XP Lv0 · Loses every upgrade and all Overdrive · Keeps +${prestige + 1} bonus levels, ${maxUpgrades(prestige + 1)} gear slots and x${next.toFixed(2)} XP`,
			confirmLabel: t`Prestige`,
			color: '#ff4089',
			onConfirm: () => void run(),
		});
	};

	return (
		<div className={`upgrade__row ${ready ? 'is-ready' : ''}`}>
			<div className="upgrade__meta">
				<span className="upgrade__skill">{skillName(skill.name)}</span>
				<span className="upgrade__level">
					<Trans>Lv<SkillLevel level={level} xp={xp} prestige={prestige} lifetimeXp={lifetimeXp} /></Trans>
				</span>
				{prestige > 0 && (
					<span className="upgrade__mult"><Trans>x{multiplier.toFixed(2)} XP</Trans></span>
				)}
			</div>
			<div className="upgrade__info">
				<span className="upgrade__desc">
					{prestige > 0
						? <Trans>{prestige} prestiges · +{prestige} bonus levels</Trans>
						: <Trans>No prestige</Trans>}
				</span>
			</div>
			<div className="upgrade__action">
				<button
					className="upgrade__buy"
					disabled={!ready || busy}
					onClick={confirm}
				>
					{ready
						? <Trans>Prestige</Trans>
						: <Trans>Requires XP Lv{required}</Trans>}
				</button>
			</div>
			{confirming && <ConfirmMenu
				{...confirming}
				onClose={() => setConfirming(undefined)}
			/>}
		</div>
	);
}
