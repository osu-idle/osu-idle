import './SkillBar.css';

import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';
import { SkillName } from '@osu-idle/shared/skills';
import { level as dlevel } from '@osu-idle/shared/display/num';
import SkillLevel from '@osu-idle/shared/display/SkillLevel';
import { skillName } from '@osu-idle/shared/display/skills';

export function SkillBar({ skill, progress: {
	level, xp, prestige, lifetimeXp,
} }: {
	skill: SkillName,
	progress: {
		level: number, xp: number, prestige?: number, lifetimeXp?: number
	}
}) {
	const toNext = xpForLevel(level);
	const percent = toNext > 0 ? Math.min(1, xp / toNext) : 0;
	// the overall level stays the xp one; a skill shows what it plays at
	const overall = String(skill) === 'overall';
	return (
		<li className='skill'>
			<span className='skill__name'>{skillName(skill)}</span>
			<div
				className='skill__track'
				title={
					`${Math.round(xp).toLocaleString()} / ${Math.round(toNext).toLocaleString()} XP to next level`
				}
			>
				<div className='skill__fill' style={{ width: `${percent*100}%` }} />
			</div>
			<span className='skill__level'>
				{overall
					? <>{dlevel(level, xp)}<span className='skill__cap'>{level < 100 && '/100'}</span></>
					: <SkillLevel level={level} xp={xp} prestige={prestige} lifetimeXp={lifetimeXp} />}
			</span>
		</li>
	);
}