import './Balancing.css';

import { useAdmin } from '../../hooks/useAdmin';
import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';
import OsuPlot, { precise4 } from '../../components/OsuPlot';
import { accBasedScoreFactor, factorXP, getRecoveryTime, lowDensityBasedNotesFactor, mapXP, speedBasedScoreFactor } from '@osu-idle/shared/sim/bots/character';
import { SKILL } from '@osu-idle/shared/skills';
import Reading from '@osu-idle/shared/sim/skills/reading';
import Speed from '@osu-idle/shared/sim/skills/speed';
import Stamina from '@osu-idle/shared/sim/skills/stamina';
import JackSpeed from '@osu-idle/shared/sim/skills/jackspeed';
import normalize from '@osu-idle/shared/math/normalize';

export default function BalancingPage() {
	const admin = useAdmin();

	if (!admin) return <main>Unauthorized</main>;

	const getProgression = (processor: (level: number, previous?: number) => number, from = 0, to = 110, step = 1) => {
		const x: number[] = [];
		const y: number[] = [];
		let prev: number | undefined = undefined;
		for (let i = from; i <= to; i += step) {
			prev = processor(i, prev);
			x.push(i);
			y.push(prev);
		}
		return { x, y };
	};

	const totalXP = getProgression((n, m) => xpForLevel(n) + (m ?? 0));
	const xpConversion = getProgression(n => mapXP(n), 0, 1000);
	const xpBaseline = getProgression(n => n, 0, 1000);
	
	const scoreXP = getProgression(n => factorXP(SKILL.jackspeed, 50, 70, {
		accuracy: n / 100,
		MISS: 0,
	}, 1000, 100, 120), 90, 100, 0.1);
	
	const accXPFactorSS = getProgression(n => accBasedScoreFactor(n, {
		accuracy: 1,
		MISS: 0,
	}));
	
	const accXPFactorS = getProgression(n => accBasedScoreFactor(n, {
		accuracy: 0.96,
		MISS: 0,
	}));
	
	const speedXPFactorS = getProgression(n => speedBasedScoreFactor(n, {
		accuracy: 0.96,
		MISS: 0,
	}));
	
	const speedXPFactorA = getProgression(n => speedBasedScoreFactor(n, {
		accuracy: 0.90,
		MISS: 0,
	}));
	
	const transposed = getProgression(n => lowDensityBasedNotesFactor(n, 50), 0, 110);
	
	const recoveryBase = getProgression(n => n, 0, 60);
	const recovery = getProgression(n => getRecoveryTime(0, n * 1000) / 1000, 0, 60);
	
	const skillReadingNotes = getProgression(n => Reading.computeForLevel(n).notes);
	const skillReadingAbove = getProgression(n => Reading.computeForLevel(n).above);
	
	const skillSpeedComfort = getProgression(n => Speed.computeForLevel(n).comfortnps);
	const skillSpeedNps = getProgression(n => Speed.computeForLevel(n).nps);
	
	const skillStaminaNps = getProgression(n => Stamina.computeForLevel(n).nps);
	const skillStaminaFatigue = getProgression(n => Stamina.computeForLevel(n).fatigueRate);
	const skillStaminaRecovery = getProgression(n => Stamina.computeForLevel(n).recoveryRate);
	
	const skillJackComfort = getProgression(n => JackSpeed.computeForLevel(n).comfort);
	const skillJackNps = getProgression(n => JackSpeed.computeForLevel(n).nps);
	const skillJackMax = getProgression(n => JackSpeed.computeForLevel(n).max);

	const test = getProgression(n => normalize(n, [70, 100]));
	return (
		<main>
			<div className="page-contents">
				<OsuPlot
					title="Test"
					xTitle="X"
					yTitle="Y"
					series={[{ name: 'Y', x: test.x, y: test.y }]}
				/>

				<OsuPlot
					title="Total XP progression"
					xTitle="Level"
					yTitle="Cumulative XP"
					layout={{ yaxis: { type: 'log' } }}
					series={[{ name: 'Total XP', x: totalXP.x, y: totalXP.y }]}
				/>
				<OsuPlot
					title="XP conversion"
					xTitle="Note XP"
					yTitle="Gained XP"
					series={[
						{ name: 'Gained XP', x: xpConversion.x, y: xpConversion.y },
						{ name: 'Baseline XP', x: xpBaseline.x, y: xpBaseline.y, color: '#d67a8e28' },
					]}
					layout={{
						yaxis: {
							dtick: 100,
						}
					}}
				/>
				<OsuPlot
					title="Skill XP"
					xTitle="Accuracy"
					yTitle="XP"
					series={[
						{ name: 'XP', x: scoreXP.x, y: scoreXP.y },
					]}
				/>
				<OsuPlot
					title="Acc Skill XP for SS"
					xTitle="Level"
					yTitle="Factor"
					yHoverFormat={precise4}
					series={[
						{ name: 'Level', x: accXPFactorSS.x, y: accXPFactorSS.y },
					]}
				/>
				<OsuPlot
					title="Acc Skill XP for S"
					xTitle="Level"
					yTitle="Factor"
					yHoverFormat={precise4}
					series={[
						{ name: 'Level', x: accXPFactorS.x, y: accXPFactorS.y },
					]}
				/>
				<OsuPlot
					title="Speed Skill XP for S"
					xTitle="Level"
					yTitle="Factor"
					yHoverFormat={precise4}
					series={[
						{ name: 'Level', x: speedXPFactorS.x, y: speedXPFactorS.y },
					]}
				/>
				<OsuPlot
					title="Speed Skill XP for A"
					xTitle="Factor"
					yTitle="Level"
					yHoverFormat={precise4}
					series={[
						{ name: 'Level', x: speedXPFactorA.x, y: speedXPFactorA.y },
					]}
				/>
				<OsuPlot
					title="Transposed level into acc"
					xTitle="Level"
					yTitle="Accuracy"
					yHoverFormat={precise4}
					series={[
						{ name: 'Accuracy', x: transposed.x, y: transposed.y },
					]}
				/>

				Fatigue recovery
				<OsuPlot
					title="Fatigue recup"
					xTitle="Seconds"
					yTitle="Seconds Recovered"
					series={[
						{ name: 'Base', x: recoveryBase.x, y: recoveryBase.y, color: '#c0437d28' },
						{ name: 'Tweaked', x: recovery.x, y: recovery.y },
					]}
				/>

				Reading
				<OsuPlot
					title="Reading transitions scaling"
					xTitle="Level"
					yTitle="Transitions"
					yHoverFormat={precise4}
					series={[
						{ name: 'Transitions', x: skillReadingNotes.x, y: skillReadingNotes.y },
						{ name: 'Above Transitions', x: skillReadingAbove.x, y: skillReadingAbove.y },
					]}
				/>

				Speed
				<OsuPlot
					title="Speed scaling"
					xTitle="Level"
					yTitle="Weighted NPS"
					yHoverFormat={precise4}
					series={[
						{ name: 'Weighted NPS Comfort', x: skillSpeedComfort.x, y: skillSpeedComfort.y },
						{ name: 'Weighted NPS MAX', x: skillSpeedNps.x, y: skillSpeedNps.y },
					]}
				/>

				Stamina
				<OsuPlot
					title="Stamina scaling"
					xTitle="Level"
					yTitle="NPS"
					yHoverFormat={precise4}
					series={[
						{ name: 'NPS', x: skillStaminaNps.x, y: skillStaminaNps.y },
					]}
				/>
				<OsuPlot
					title="Stamina scaling"
					xTitle="Level"
					yTitle="Fatigue"
					yHoverFormat={precise4}
					series={[
						{ name: 'Fatigue rate', x: skillStaminaFatigue.x, y: skillStaminaFatigue.y },
						{ name: 'Recovery rate', x: skillStaminaRecovery.x, y: skillStaminaRecovery.y },
					]}
				/>

				Jackspeed
				<OsuPlot
					title="Jackspeed scaling"
					xTitle="Level"
					yTitle="NPS"
					yHoverFormat={precise4}
					series={[
						{ name: 'Comfort', x: skillJackComfort.x, y: skillJackComfort.y },
						{ name: 'NPS', x: skillJackNps.x, y: skillJackNps.y, color: 'rgba(169, 122, 214, 0.3)' },
						{ name: 'Max', x: skillJackMax.x, y: skillJackMax.y, color: '#c0434328' },
					]}
				/>
			</div>
		</main>
	);
}
