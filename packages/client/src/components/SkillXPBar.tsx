import { useEffect, useState } from 'react';
import Skill from '@osu-idle/shared/sim/skills/skill';
import { SkillProgress } from '@osu-idle/shared/sim/bots/character';

const SEGMENT_MS = 2000;     // time to pour a full level's worth of fill
const MIN_SEGMENT_MS = 1000; // floor so tiny gains still read as a fill
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

type Segment = { level: number, from: number, to: number };

/**
 * Break the gain into per-level fill segments. Every segment but the last ends
 * flush at a level boundary (fill 1), so the bar visibly tops out, pops the
 * level, and refills from empty for each level crossed - landing exactly on the
 * persisted (toLevel, toXp).
 */
function buildSegments({ fromLevel, fromXp, toLevel, toXp }: SkillProgress): Segment[] {
	const startFill = fromXp / Skill.xpForLevel(fromLevel);
	if (toLevel === fromLevel) {
		return [{ level: fromLevel, from: startFill, to: toXp / Skill.xpForLevel(toLevel) }];
	}
	const segs: Segment[] = [{ level: fromLevel, from: startFill, to: 1 }];
	for (let l = fromLevel + 1; l < toLevel; l++) {
		segs.push({ level: l, from: 0, to: 1 });
	}
	segs.push({ level: toLevel, from: 0, to: toXp / Skill.xpForLevel(toLevel) });
	return segs;
}

/** One skill row on the result screen: name, live level, filling XP bar, gain. */
export default function SkillXPBar({ progress, delay = 0 }: { progress: SkillProgress, delay?: number }) {
	const { skill, gained, fromLevel } = progress;
	const startFill = progress.fromXp / Skill.xpForLevel(fromLevel);
	const [state, setState] = useState({ level: fromLevel, fill: startFill });
	// gate the fill on the entrance animation actually finishing, so it starts
	// the instant the bar has appeared - no hand-tuned delay to keep in sync.
	const [appeared, setAppeared] = useState(false);

	useEffect(() => {
		if (!appeared) return;
		const segs = buildSegments(progress);
		const durs = segs.map((s) => Math.max(MIN_SEGMENT_MS, SEGMENT_MS * (s.to - s.from)));
		let start = 0;
		let raf = 0;
		const tick = (now: number) => {
			if (!start) start = now;
			let elapsed = now - start;
			let i = 0;
			while (i < segs.length - 1 && elapsed >= durs[i]) {
				elapsed -= durs[i];
				i++;
			}
			const seg = segs[i];
			const t = Math.min(1, elapsed / durs[i]);
			setState({ level: seg.level, fill: seg.from + (seg.to - seg.from) * easeOutCubic(t) });
			if (i < segs.length - 1 || t < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [progress, appeared]);

	const gainedLevels = state.level - fromLevel;
	const leveled = gainedLevels > 0;

	return (
		<div
			className={`skillxp__row ${leveled ? 'is-leveled' : ''}`}
			style={{ animationDelay: `${delay}ms` }}
			onAnimationEnd={(e) => { if (e.animationName === 'skillxp-enter') setAppeared(true); }}
		>
			<span className="skillxp__name">{skill}</span>
			{/* keyed so each level-up remounts and replays the pop animation */}
			<span className="skillxp__level" key={state.level}>
				<i>Lv</i>{state.level}
				{gainedLevels > 0 && <em className="skillxp__levelup" key={gainedLevels}>▲{gainedLevels}</em>}
			</span>
			<div className="skillxp__track">
				<div className="skillxp__fill" style={{ width: `${state.fill * 100}%` }} />
			</div>
			<span className="skillxp__gain">
				{gained > 0 ? `+${gained}xp` : '--'}
			</span>
		</div>
	);
}
