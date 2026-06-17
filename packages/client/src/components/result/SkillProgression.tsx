import { Trans } from '@lingui/react/macro';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import SkillXPBar from '../SkillXPBar';

/** The per-skill XP bars earned this play (sorted biggest-first), or an empty
 *  note. Renders nothing for a failed play or one that awards no XP. */
export default function SkillProgression({ failed, progression, gains }: {
	failed?: boolean;
	progression?: SkillProgress[];
	gains: SkillProgress[];
}) {
	if (failed || !progression) return null;
	if (gains.length === 0) return <div className="result__skills-empty"><Trans>No skill gains</Trans></div>;
	return (
		<div className="result__skills">
			{gains.map((p, i) => (
				<SkillXPBar key={p.skill} progress={p} delay={500 + i * 900} />
			))}
		</div>
	);
}
