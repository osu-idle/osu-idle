import './PlayerCard.css';
import {
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import { countryName } from '@osu-idle/shared/display/country';
import { statusName } from '@osu-idle/shared/display/community';
import accuracyText from '@osu-idle/shared/display/accuracy';
import type { PresenceEntry } from '@osu-idle/shared/community/presence';

/**
 * One online character, osu!stable user-panel style: avatar, name and a
 * status-tinted strip. Shows the character's stats, swapping to its local time,
 * country and status on hover.
 */
export default function PlayerCard({ character }: { character: PresenceEntry }) {
	const { i18n } = useLingui();

	// Fade the avatar in on load - but skip the fade if it's already cached
	// (complete before we mount), so cached cards don't flash.
	const avatarRef = useRef<HTMLImageElement>(null);
	const [avatarLoaded, setAvatarLoaded] = useState(false);
	const [avatarInstant, setAvatarInstant] = useState(false);
	useLayoutEffect(() => {
		if (avatarRef.current?.complete) {
			setAvatarInstant(true);
			setAvatarLoaded(true);
		}
	}, []);

	// Fall back to the viewer's local zone when the character has no geo tz
	// (e.g. localhost / a lookup miss) so it shows a time, not a dash.
	const localTime = new Intl.DateTimeFormat(i18n.locale, {
		hour: '2-digit',
		minute: '2-digit',
		...(character.tz ? { timeZone: character.tz } : {}),
	}).format(new Date());
	const country = countryName(character.country, i18n.locale);
	const statusText = character.status === 'playing' && character.nowPlaying
		? character.nowPlaying
		: statusName(character.status);

	const pp = Math.round(character.pp).toLocaleString(i18n.locale);
	const accuracy = accuracyText(character.accuracy);
	const playCount = character.playCount.toLocaleString(i18n.locale);
	const level = character.level;

	return (
		<div
			className="player-card"
			data-status={character.status}
		>
			<div className="player-card__avatar">
				<img
					ref={avatarRef}
					src={character.avatarUrl}
					alt=""
					data-loaded={avatarLoaded}
					data-instant={avatarInstant}
					onLoad={() => setAvatarLoaded(true)}
				/>
			</div>
			<div className="player-card__body">
				<span className="player-card__rank">{character.rank ? `#${character.rank}` : '—'}</span>
				<span className="player-card__name">{character.name}</span>
				<div className="player-card__meta">
					<div className='player-card-side recto'>
						<span className="player-card__sub"><Trans>Performance: {pp}</Trans></span>
						<span className="player-card__sub"><Trans>Accuracy: {accuracy}</Trans></span>
						<span className="player-card__sub"><Trans>Play Count: {playCount} (Lv{level})</Trans></span>
					</div>
					<div className='player-card-side verso'>
						<span className="player-card__sub">{localTime} @ {country}</span>
						<span className="player-card__sub">{statusText}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
