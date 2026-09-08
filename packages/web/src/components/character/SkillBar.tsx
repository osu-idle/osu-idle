import './SkillBar.css';

import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';
import { SkillName } from '@osu-idle/shared/skills';
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
	// overall has no prestige to add, so it reads as the xp level either way -
	// but it still earns the hover, and the lifetime behind it
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
				<SkillLevel level={level} xp={xp} prestige={prestige} lifetimeXp={lifetimeXp} />
				{overall && <span className='skill__cap'>{level < 100 && '/100'}</span>}
			</span>
			{/* one star per prestige, on a line under the whole row - a count
			    beside the name was too small to read. The line is always there,
			    so one prestiged skill does not make its row taller than the rest. */}
			<span
				className='skill__prestige'
				title={prestige
					? `Prestiged ${prestige} time${prestige === 1 ? '' : 's'}`
					: undefined}
			>{'★'.repeat(prestige ?? 0)}</span>
		</li>
	);
}