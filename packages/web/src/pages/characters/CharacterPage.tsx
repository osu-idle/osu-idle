import './CharacterPage.css';

import { getCharacter, getCharacterBestPP, getCharacterCountPlayed, getCharacterFirstPlaces, getCharacterMostPlayed, getCharacterNbFirstPlaces, getCharacterRecent, getCharacterStats } from '../../api/characters';
import { getUser } from '../../api/users';
import { PageProps } from '../../router';
import Flag from '../../components/Flag';
import ProfilePicture from '../../components/ProfilePicture';
import EditableProfilePicture from '../../components/EditableProfilePicture';
import { refreshCurrentUser, useCurrentUser } from '../../hooks/useCurrentUser';
import { useState } from 'react';
import { Judgements } from '@osu-idle/shared/judgement';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import rank from '@osu-idle/shared/display/rank';
import num from '@osu-idle/shared/display/num';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import accuracy from '@osu-idle/shared/display/accuracy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import ScoreRow from '../../components/score/ScoreRow';
import Grade from '../../components/score/Grade';
import { SkillBar } from '../../components/character/SkillBar';
import { SkillName } from '@osu-idle/shared/skills';
import { extractSkills } from '@osu-idle/shared/osu/level';

/** Headline grades shown in the totals block (best play per beatmap). */
const GRADE_DISPLAY = ['X', 'SS', 'S', 'A'] as const;

export default function CharacterPage({ params }: PageProps) {
	const character = useAsync(() => getCharacter(params.id), [params]);
	const stats = useAsync(() => getCharacterStats(params.id), [params]);
	const user = useAsync(() => character && getUser(character.userId), [character]);

	const me = useCurrentUser();
	const isSelf = !!me && !!character && me.id === character.userId;
	// Once the player changes their own avatar, show the new one without a refetch.
	const [avatarOverride, setAvatarOverride] = useState<string | null>();
	
	const countplayed = useAsync(() => getCharacterCountPlayed(params.id), [params]);
	const mostplayed = useAsync(() => getCharacterMostPlayed(params.id, 1), [params]);
	
	const bestpp = useAsync(() => getCharacterBestPP(params.id, 1), [params]);
	
	const countfirstplaces = useAsync(() => getCharacterNbFirstPlaces(params.id), [params]);
	const firstplaces = useAsync(() => getCharacterFirstPlaces(params.id, 1), [params]);
	
	const recentscores = useAsync(() => getCharacterRecent(params.id, 1), [params]);

	if (!character || !user || !stats) return <main>Loading…</main>;

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
						<div className='character__meta-country'>{user.country}</div>
					</div>
				</div>
			</div>
			<div className='character__stats'>
				<div className='character__main_stats'>
					<div className='character__ranks'>
						<div className='character__ranks-area'>
							<div className='character__ranks-label'>Global Ranking</div>
							<div className='character__ranks-num'>{rank(stats.globalRank)}</div>
						</div>
						<div className='character__ranks-area'>
							<div className='character__ranks-label'>Country Ranking</div>
							<div className='character__ranks-num'>{rank(stats.countryRank)}</div>
						</div>
						<div className='character__ranks-area'>
							<div className='character__ranks-label'>Score Ranking</div>
							<div className='character__ranks-num'>{rank(stats.scoreRank)}</div>
						</div>
					</div>
					<div className='character__graph'>
					</div>
					<div className='character__totals'>
						<div className='character__totals_left'>
							<div className='character__totals-left-area'>
								<div className='character__totals-left-label'>pp</div>
								<div className='character__totals-left-num'>{num(Math.round(stats.pp))}</div>
							</div>
							<div className='character__totals-left-area'>
								<div className='character__totals-left-label'>Play Count</div>
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
						<div className='character__stats-label'>Ranked Score</div>
						<div className='character__stats-num'>{num(stats.rankedScore)}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'>Hit Accuracy</div>
						<div className='character__stats-num'>{accuracy(hitAccuracy(stats))}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'>Total Score</div>
						<div className='character__stats-num'>{num(stats.totalScore)}</div>
					</div>
					<div className='character__stats-area'>
						<div className='character__stats-label'>Total Hits</div>
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
					<div className='character__block-title'>Skills</div>
					<div className='main-skill'><SkillBar skill={'Global' as SkillName} progress={{ level: character.overallLevel, xp: character.overallXp }} /></div>
					<ul className='skills'>
						{Object.entries(extractSkills(character)).map(([skill, progress]) => <SkillBar skill={skill as SkillName} progress={progress} />)}
					</ul>
				</div>
				<div className='character__block character__block-skills'>
					<div className='character__block-title'>Ranks</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>Best Performance<div className='character__block-section-title-count'>{num(Math.min(200, countplayed ?? 0))}</div></div>
						<div className='character__best_pp'>
							{bestpp?.map(score => <ScoreRow score={score.best_pp} beatmap={score.beatmap} />)}
						</div>
					</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>First Place Ranks<div className='character__block-section-title-count'>{num(countfirstplaces)}</div></div>
						<div className='character__first_places'>
							{firstplaces?.map(score => <ScoreRow score={score.first_place} beatmap={score.beatmap} />)}
						</div>
					</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>Recent scores<div className='character__block-section-title-count'>{num(recentscores?.length)}</div></div>
						<div className='character__first_places'>
							{recentscores?.map(score => <ScoreRow score={score.score} beatmap={score.beatmap} />)}
						</div>
					</div>
				</div>
				<div className='character__block character__block-skills'>
					<div className='character__block-title'>Historical</div>
					<div className='character__block-section'>
						<div className='character__block-section-title'>Most Played Beatmaps<div className='character__block-section-title-count'>{num(countplayed)}</div></div>
						<div className='character__mostplayed'>
							{mostplayed?.map(mp => <div className='mostplayed__container'>
								<div className='mostplayed__bg' style={{ backgroundImage: `url('https://assets.ppy.sh/beatmaps/${mp.beatmapset.id}/covers/list.jpg')` }}></div>
								<div className='mostplayed__bm'>
									<div className='mostplayed__bminfo'>
										<div className='mostplayed__bmt'>
											{mp.beatmap.title} [{mp.beatmap.version}] by {mp.beatmap.artist}
										</div>
										<div className='mostplayed__bmc'>
											mapped by <b>{mp.beatmapset.creator}</b>
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