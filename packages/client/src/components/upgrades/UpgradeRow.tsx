import { useState } from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import type Skill from '@osu-idle/shared/sim/skills/skill';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	skillName,
	upgradeDescription,
	upgradeLabel,
} from '@osu-idle/shared/display/skills';
import {
	MAX_UPGRADES,
	UPGRADE_LEVELS,
	applyUpgrade,
	canUpgrade,
	upgradeXPMultiplier,
	upgradeMinLevel,
	type UpgradeState,
} from '@osu-idle/shared/upgrades';
import num, { level as levelDisplay } from '@osu-idle/shared/display/num';
import { overdriveText } from '@osu-idle/shared/display/overdrive';
import ConfirmMenu, { type Confirm } from '../ConfirmMenu';
import { purchaseUpgrade } from '../../online/services/upgrades';

/** Dry-run of what buying right now would do; undefined when not purchasable. */
const previewPurchase = (locked: boolean, state: UpgradeState) => {
	if (locked || !canUpgrade(state)) return undefined;
	return applyUpgrade(state);
};

export default function UpgradeRow({
	skill,
	locked,
}: {
	skill: Skill,
	locked: boolean,
}) {
	const { t } = useLingui();
	const [level] = useSynced(skill.level);
	const [xp] = useSynced(skill.xp);
	const [upgrades] = useSynced(skill.upgrades);
	const [overdrive] = useSynced(skill.overdrive);
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState<Confirm | undefined>(undefined);

	const maxed = upgrades >= MAX_UPGRADES;
	const minLevel = upgradeMinLevel(upgrades);
	const preview = previewPurchase(locked, {
		level, xp, upgrades, overdrive,
	});
	const purchasable = !!preview;
	const ratio = preview?.ratio ?? 0;
	const ratioText = overdriveText(ratio);
	const odText = overdriveText(overdrive);
	const multiplier = upgradeXPMultiplier(upgrades, overdrive);
	const multiplierText = multiplier.toFixed(2);

	const buy = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await purchaseUpgrade(skill.name);
		} finally {
			setBusy(false);
		}
	};

	const confirm = () => {
		if (!preview || busy) return;
		const name = skillName(skill.name);
		const nextGear = upgradeLabel(skill.name, upgrades + 1);
		const spent = num(Math.round(preview.spent));
		const boost = upgradeXPMultiplier(preview.upgrades, preview.overdrive).toFixed(2);
		const odSegment = preview.overdrive !== overdrive
			? t` · Overdrive ${odText} → ${overdriveText(preview.overdrive)}`
			: overdrive > 0 ? t` · Overdrive ${odText}` : '';
		setConfirming({
			title: t`Buy ${nextGear}?`,
			sub: t`${name} Lv${level} → Lv${preview.level} · Costs ${spent}xp${odSegment} · XP boost x${boost}`,
			confirmLabel: t`Buy`,
			color: '#ff4089',
			onConfirm: () => void buy(),
		});
	};

	return (
		<div className={`upgrade__row ${maxed ? 'is-maxed' : purchasable ? 'is-ready' : ''}`}>
			<div className="upgrade__meta">
				<span className="upgrade__skill">{skillName(skill.name)}</span>
				<span className="upgrade__level">
					<Trans>Lv{levelDisplay(level, xp)}</Trans>{' '}
					{overdrive > 0 && (odText)}
				</span>
				{multiplier > 1 && (
					<span className="upgrade__mult"><Trans>x{multiplierText} XP</Trans></span>
				)}
			</div>
			<div className="upgrade__info">
				<span className="upgrade__desc">{upgradeDescription(skill.name)}</span>
				<div className="upgrade__gear">
					<span className="upgrade__gear-current">{upgradeLabel(skill.name, upgrades)}</span>
					{!maxed && (<>
						<span className="upgrade__gear-arrow">→</span>
						<span className="upgrade__gear-next">{upgradeLabel(skill.name, upgrades + 1)}</span>
					</>)}
				</div>
			</div>
			<div className="upgrade__action">
				{ratio > 1 && (
					<span className="upgrade__overdrive">
						<Trans>Overdrive +{ratioText}</Trans>
					</span>
				)}
				<button
					className="upgrade__buy"
					disabled={!purchasable || busy}
					onClick={confirm}
				>
					{maxed
						? <Trans>Maxed</Trans>
						: purchasable
							? <Trans>Buy: {UPGRADE_LEVELS} levels</Trans>
							: <Trans>Requires Lv{minLevel}</Trans>}
				</button>
			</div>
			{confirming && <ConfirmMenu
				{...confirming}
				onClose={() => setConfirming(undefined)}
			/>}
		</div>
	);
}
