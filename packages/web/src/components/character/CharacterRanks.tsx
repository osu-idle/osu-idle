import rank from '@osu-idle/shared/display/rank';
import { skillName } from '@osu-idle/shared/display/skills';
import type { getCharacterStats } from '../../api/characters';
import { Trans } from '@lingui/react/macro';

type Stats = Awaited<ReturnType<typeof getCharacterStats>>;

export function CharacterRanks({ stats }: { stats: Stats }) {
	const skill = stats.bestSkill ? skillName(stats.bestSkill.skill) : '';
	return (
		<div className='character__ranks'>
			<div className='character__ranks-area'>
				<div className='character__ranks-label'><Trans>Global Ranking</Trans></div>
				<div className='character__ranks-num'>{rank(stats.globalRank)}</div>
			</div>
			<div className='character__ranks-area'>
				<div className='character__ranks-label'><Trans>Country Ranking</Trans></div>
				<div className='character__ranks-num'>{rank(stats.countryRank)}</div>
			</div>
			<div className='character__ranks-area'>
				<div className='character__ranks-label'><Trans>Score Ranking</Trans></div>
				<div className='character__ranks-num'>{rank(stats.scoreRank)}</div>
			</div>
			<div className='character__ranks-area'>
				<div className='character__ranks-label'><Trans>Skill Ranking</Trans></div>
				<div className='character__ranks-num'>{rank(stats.overallRank)}</div>
			</div>
			{stats.bestSkill && (
				<div className='character__ranks-area'>
					<div className='character__ranks-label'><Trans>{skill} Ranking</Trans></div>
					<div className='character__ranks-num'>{rank(stats.bestSkill?.rank)}</div>
				</div>
			)}
		</div>
	);
}
