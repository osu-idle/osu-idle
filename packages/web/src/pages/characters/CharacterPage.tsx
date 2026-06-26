import './CharacterPage.css';

import {
	getCharacter,
	getCharacterBestPP,
	getCharacterCountPlayed,
	getCharacterFirstPlaces,
	getCharacterMostPlayed,
	getCharacterNbFirstPlaces,
	getCharacterRecent,
	getCharacterStats,
} from '../../api/characters';
import { getUser } from '../../api/users';
import Flag from '../../components/Flag';
import ProfilePicture from '../../components/ProfilePicture';
import EditableProfilePicture from '../../components/EditableProfilePicture';
import {
	refreshCurrentUser,
	useCurrentUser,
} from '../../hooks/useCurrentUser';
import { useState } from 'react';
import { Judgements } from '@osu-idle/shared/judgement';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import ScoreRow from '../../components/score/ScoreRow';
import Grade from '../../components/score/Grade';
import { SkillBar } from '../../components/character/SkillBar';
import { CharacterRanks } from '../../components/character/CharacterRanks';
import { SkillName } from '@osu-idle/shared/skills';
import { extractSkills } from '@osu-idle/shared/osu/level';
import { Trans } from '@lingui/react/macro';
import { countryName } from '@osu-idle/shared/display/country';
import { i18n } from '../../i18n';

/** Headline grades shown in the totals block (best play per beatmap). */
const GRADE_DISPLAY = ['X', 'SS', 'S', 'A'] as const;

type Character = Awaited<ReturnType<typeof getCharacter>>;
type Stats = Awaited<ReturnType<typeof getCharacterStats>>;

export default function CharacterPage({ id, character, stats }: {
	id: string;
	character: Character;
	stats: Stats;
}) {
	const user = useAsync(() => getUser(character.userId), [character]);

	const me = useCurrentUser();
	const isSelf = !!me && me.id === character.userId;
	// Once the player changes their own avatar, show the new one without a refetch.
	const [avatarOverride, setAvatarOverride] = useState<string | null>();

	const countplayed = useAsync(() => getCharacterCountPlayed(id), [id]);
	const mostplayed = useAsync(() => getCharacterMostPlayed(id, 1), [id]);

	const bestpp = useAsync(() => getCharacterBestPP(id, 1), [id]);

	const countfirstplaces = useAsync(() => getCharacterNbFirstPlaces(id), [id]);
	const firstplaces = useAsync(() => getCharacterFirstPlaces(id, 1), [id]);

	const recentscores = useAsync(() => getCharacterRecent(id, 1), [id]);

	if (!user) return <main><Trans>Loading…</Trans></main>;

	return (
		<main>
			<div className='character__banner'></div>
			<div className='character__info'>
				{isSelf
					? <EditableProfilePicture
						avatarUrl={avatarOverride !== undefined ? avatarOverride : character.avatarUrl}
						className='character__avatar'
						onChange={url => { setAvatarOverride(url); void refreshCurrentUser(); }}
					/>
					: <ProfilePicture avatarUrl={character.avatarUrl} className='character__avatar' />}
				<div className='character__meta'>
					<div className='character__meta-up'>
						<div className='character__meta-name'>{character.name}</div>
					</div>
					<div className='character__meta-down'>
						<div className='character__meta-flag'><Flag country={user.country} /></div>
						<div className='character__meta-country'>{countryName(user.country, i18n.locale)}</div>
					</div>
				</div>
			</div>
			<div className='character__stats'>
				<div className='character__main_stats'>
					<CharacterRanks stats={stats} />
					<div className='character__graph'>
					</div>
					<div className='character__totals'>
						<div className='character__totals_left'>
							<div className='character__totals-left-area'>
								<div className='character__totals-left-label'>pp</div>
								<div className='character__totals-left-num'>{num(Math.round(stats.pp))}</div>
							</div>
							<div className='character__totals-left-area'>
								<div className='character__totals-left-label'><Trans>Play Count</Trans></div>
								<div className='character__totals-left-num'>{num(stats.playCount)}</div>
							</div>
						</div>
						<div className='character__totals_grades'>
							{GRADE_DISPLAY.map(g => (
								<div key={g} className='character__grades-area'>
									<Grade grade={g} />
									<div className='character__grades-num'>{num(stats[g])}</div>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className='character__stats_sep'></div>
				<div className='character__all_stats'>
					<div className='character__stats-area'>
						<div className='character__stats-label'><Trans>Ranked Score</Trans></div>
						<div className='character__stats-num'>{num(stats.rankedScore)}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'><Trans>Hit Accuracy</Trans></div>
						<div className='character__stats-num'>{accuracy(hitAccuracy(stats))}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'><Trans>Total Score</Trans></div>
						<div className='character__stats-num'>{num(stats.totalScore)}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'><Trans>Total Hits</Trans></div>
						<div className='character__stats-num'>{num(stats.totalHits)}</div>
					</div>
					{Judgements.map(j => (
						<div key={j} className='character__stats-area'>
							<div className={`character__stats-label character__stats-judge judge-${j}`}>{j}</div>
							<div className='character__stats-num'>{num(stats[j])}</div>
						</div>
					))}
				</div>
			</div>
			<div className='character__submeta'>
			</div>
			<div className='character__socialmeta'>
			</div>
			<div className='character__blocks'>
				<div className='character__block character__block-skills'>
					<div className='character__block-title'><Trans>Skills</Trans></div>
					<div className='main-skill'><SkillBar skill={'overall' as SkillName} progress={{
						level: character.overallLevel, xp: character.overallXp, 
					}} /></div>
					<ul className='skills'>
						{Object.entries(extractSkills(character))
							.map(([skill, progress]) => <SkillBar 
								skill={skill as SkillName}
								progress={progress} 
							/>)}
					</ul>
				</div>
				<div className='character__block character__block-skills'>
					<div className='character__block-title'><Trans>Ranks</Trans></div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>
							<Trans>Best Performance</Trans>
							<div className='character__block-section-title-count'>
								{num(Math.min(200, countplayed ?? 0))}
							</div>
						</div>
						<div className='character__best_pp'>
							{bestpp?.map(score => <ScoreRow score={score.best_pp} beatmap={score.beatmap} />)}
						</div>
					</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>
							<Trans>First Place Ranks</Trans>
							<div className='character__block-section-title-count'
							>{num(countfirstplaces)}
							</div>
						</div>
						<div className='character__first_places'>
							{firstplaces?.map(score => <ScoreRow score={score.first_place} beatmap={score.beatmap} />)}
						</div>
					</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>
							<Trans>Recent scores</Trans>
							<div className='character__block-section-title-count'>
								{num(recentscores?.length)}
							</div>
						</div>
						<div className='character__first_places'>
							{recentscores?.map(score => <ScoreRow score={score.score} beatmap={score.beatmap} />)}
						</div>
					</div>
				</div>
				<div className='character__block character__block-skills'>
					<div className='character__block-title'><Trans>Historical</Trans></div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>
							<Trans>Most Played Beatmaps</Trans>
							<div className='character__block-section-title-count'>{num(countplayed)}
							</div>
						</div>
						<div className='character__mostplayed'>
							{mostplayed?.map(mp => <div className='mostplayed__container'>
								<div className='mostplayed__bg' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mp.beatmapset.id}/covers/list.jpg')` }}></div>
								<div className='mostplayed__bm'>
									<div className='mostplayed__bminfo'>
										<div className='mostplayed__bmt'>
											<Trans>{mp.beatmap.title} [{mp.beatmap.version}] by {mp.beatmap.artist}</Trans>
										</div>
										<div className='mostplayed__bmc'>
											<Trans>mapped by <b>{mp.beatmapset.creator}</b></Trans>
										</div>
									</div>
									<div className='mostplayed__pl'>
										<FontAwesomeIcon icon={faPlay} />
										<span>{mp.beatmaps_played.plays}</span>
									</div>
								</div>
							</div>)}
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}