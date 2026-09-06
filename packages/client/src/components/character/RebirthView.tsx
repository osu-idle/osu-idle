import { useState } from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import {
	REBIRTH_MIN_OVERALL_LEVEL,
	canRebirth,
} from '@osu-idle/shared/upgrades';
import {
	REBIRTH_UNLOCKS,
	unlocksForGeneration,
} from '@osu-idle/shared/rebirth';
import ConfirmMenu, { type Confirm } from '../ConfirmMenu';
import Entities from '../../entity/entities';
import { rebirth } from '../../online/services/prestige';
import LineageList from './LineageList';

export default function RebirthView() {
	const { t } = useLingui();
	const [character] = useSynced(Entities.character);
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState<Confirm | undefined>(undefined);

	const generation = character.generation;
	const owned = unlocksForGeneration(generation);
	const next = REBIRTH_UNLOCKS[owned.length];
	const ready = character.id !== 0 && canRebirth(character.overallLevel) && !!name.trim();

	const run = async () => {
		if (busy) return;
		setBusy(true);
		try {
			await rebirth(name.trim());
		} finally {
			setBusy(false);
		}
	};

	const confirm = () => {
		if (!ready || busy) return;
		const wanted = name.trim();
		const handover = wanted === character.name
			? t`${character.name} becomes ${character.name}_old`
			: t`${character.name} keeps its name`;
		setConfirming({
			title: t`Rebirth as ${wanted}?`,
			sub: t`${handover}, stays playable and ranked · The new character starts from zero and unlocks: ${next ?? 'nothing new'}`,
			confirmLabel: t`Rebirth`,
			color: '#ff4089',
			onConfirm: () => void run(),
		});
	};

	return (
		<div className="upgrades">
			<p className="upgrades__hint">
				<Trans>
					After reaching overall Lv{REBIRTH_MIN_OVERALL_LEVEL} you can start over
					with a new character one generation up, which permanently unlocks a new
					feature. Everything you have now stays available: the old character
					remains playable, keeps its levels, and stays on the leaderboards. Pick
					a new name, or keep your current one and the old character gets _old
					appended to its name.
				</Trans>
			</p>

			<div className="rebirth__status">
				<span>
					<Trans>Generation {generation}</Trans>
				</span>
				<span>
					<Trans>Overall Lv{character.overallLevel} / {REBIRTH_MIN_OVERALL_LEVEL}</Trans>
				</span>
				<span>
					{owned.length > 0
						? <Trans>Unlocked: {owned.join(', ')}</Trans>
						: <Trans>No unlocks yet</Trans>}
				</span>
				{next && (
					<span><Trans>Next rebirth unlocks: {next}</Trans></span>
				)}
			</div>

			<div className="rebirth__form">
				<input
					className="rebirth__name"
					value={name}
					maxLength={32}
					placeholder={t`New character name`}
					onChange={e => setName(e.target.value)}
				/>
				<button
					className="upgrade__buy"
					disabled={!ready || busy}
					onClick={confirm}
				>
					{canRebirth(character.overallLevel)
						? <Trans>Rebirth</Trans>
						: <Trans>Requires overall Lv{REBIRTH_MIN_OVERALL_LEVEL}</Trans>}
				</button>
			</div>

			<LineageList />

			{confirming && <ConfirmMenu
				{...confirming}
				onClose={() => setConfirming(undefined)}
			/>}
		</div>
	);
}
