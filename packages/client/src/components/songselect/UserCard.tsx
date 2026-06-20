import { Trans, useLingui } from '@lingui/react/macro';
import Character from '../../db/schema/character';
import { getCharacter, getCharacterStats } from '../../online/services/characters';
import { webUrl, isWebOpen } from '../../globals';
import Auth from '../../online/auth';
import num from '@osu-idle/shared/display/num';
import accuracy from '@osu-idle/shared/display/accuracy';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';
import { recentTimeAgo } from '@osu-idle/shared/display/ago';
import { GUEST_AVATAR_URL } from '@osu-idle/shared/osu/profile';

/** Profile card: avatar + online stats, clicking through to osu! web
 *  (or the login flow for a guest). Online stats only show once loaded. */
export default function UserCard({ character, online_character, online_stats }: {
	character: Character;
	online_character: Awaited<ReturnType<typeof getCharacter>> | undefined;
	online_stats: Awaited<ReturnType<typeof getCharacterStats>> | undefined;
}) {
	const { t } = useLingui();
	const nextGlobal = online_character ? xpForLevel(online_character.overallLevel) : undefined;
	const pp = num(online_character?.pp);
	const accText = online_stats && accuracy(hitAccuracy(online_stats));
	const fatigue = online_character ? accuracy(online_character.fatiguePercent) : '';
	const level = num(online_character?.overallLevel);
	return (
		<div
			className="game__user"
			title={t`Open osu! web`}
			onClick={async () => {
				if (character.isGuest()) { Auth.signIn(); return; }
				await webUrl.set(`c/${character.id}`);
				await isWebOpen.set(true);
			}}
		>
			<div className="game__avatar">
				<img className="game__avatar-img" src={online_character?.avatarUrl ?? GUEST_AVATAR_URL} alt="" />
			</div>
			<div className="game__user-meta">
				<span className="game__user-name">{character.name}</span>
				{online_character && (<>
					<span className="game__user-pp"><Trans>Performance: {pp}pp</Trans></span>
					<span className="game__user-acc"><Trans>Accuracy: {accText}</Trans>
						{online_character.sessionTime > 600000 && <span className='game__user-fatigue'>{recentTimeAgo(online_character.sessionTime)} ({fatigue})</span>}
					</span>
					<span className="game__user-level"><Trans>Lv{level}</Trans></span>
				</>)}
				{!online_character && (
					<span className="game__user-pp"><Trans>Click here to login!</Trans></span>
				)}
				<div className="game__user-level-bar">
					<div
						className="game__user-level-bar-fill"
						style={{ width: `${Math.min(1, (online_character?.overallXp ?? 0) / (nextGlobal || 1)) * 100}%` }}
					/>
				</div>
			</div>
		</div>
	);
}
