import './PlayerGrid.css';
import { useLingui } from '@lingui/react/macro';
import type { PresenceEntry } from '@osu-idle/shared/community/presence';
import PlayerCard from './PlayerCard';

/** The scrollable grid of online-character cards. */
export default function PlayerGrid({ characters }: { characters: PresenceEntry[] }) {
	const { t } = useLingui();

	if (!characters.length) {
		return <div className="community-empty">{t`No one online`}</div>;
	}

	return (
		<div className="community-grid">
			{characters.map(c => <PlayerCard key={c.characterId} character={c} />)}
		</div>
	);
}
