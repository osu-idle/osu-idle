import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import type { ReactNode } from 'react';
import SkillXPBar from '../components/SkillXPBar';
import SkillProgression from '../components/result/SkillProgression';
import XpMultiplierToggle from '../components/songselect/XpMultiplierToggle';
import UpgradeRow from '../components/upgrades/UpgradeRow';
import ConfirmMenu from '../components/ConfirmMenu';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import Skill from '@osu-idle/shared/sim/skills/skill';

const gain = (
	skill: string,
	fromLevel: number,
	toLevel: number,
	gained: number,
	toFill = 0,
): SkillProgress => ({
	skill,
	gained,
	fromLevel,
	fromXp: 0,
	toLevel,
	toXp: toFill * Skill.xpForLevel(toLevel),
	levels: toLevel - fromLevel,
} as SkillProgress);

const spread = (count: number, levels: number): SkillProgress[] =>
	['accuracy', 'speed', 'stamina', 'jackspeed', 'coordination', 'release', 'reading',
		'consistency', 'concentration', 'speedjam', 'memory']
		.slice(0, count)
		.map((s, i) => gain(s, 0, Math.max(1, levels - i * 2), 1000 * (count - i)));

/** Each case renders one component in isolation, with the inputs that are
 *  awkward to reach by playing the game. */
export const PLAYGROUND_CASES: { id: string, label: string, render: () => ReactNode }[] = [
	{
		id: 'xpbar-single',
		label: 'XP bar - one level',
		render: () => <SkillXPBar progress={gain('accuracy', 3, 4, 420)} />,
	},
	{
		id: 'xpbar-many',
		label: 'XP bar - 81 levels',
		render: () => <SkillXPBar progress={gain('accuracy', 0, 81, 298_000)} budgetMs={4000} />,
	},
	{
		id: 'xpbar-past-100',
		label: 'XP bar - 98 to 104, coloured decimals',
		render: () => <SkillXPBar progress={gain('accuracy', 98, 104, 90_000_000, 0.45)} />,
	},
	{
		id: 'progression-one',
		label: 'Progression - 1 skill',
		render: () => <SkillProgression progression={spread(1, 2)} gains={spread(1, 2)} />,
	},
	{
		id: 'progression-full',
		label: 'Progression - 10 skills, deep',
		render: () => <SkillProgression progression={spread(10, 60)} gains={spread(10, 60)} />,
	},
	{
		id: 'upgrade-tier',
		label: 'Upgrade row - Lv101 with overdrive, buying a gear tier',
		render: () => {
			const skill = makeOrderedSkills().find(s => s.name === 'accuracy')!;
			void skill.level.set(101);
			void skill.xp.set(Skill.xpForLevel(101) * 0.35);   // decimals visible
			void skill.upgrades.set(10);
			void skill.overdrive.set(4.2);
			void skill.prestige.set(1);
			return <UpgradeRow skill={skill} locked={false} />;
		},
	},
	{
		id: 'confirm-rebirth',
		label: 'Confirm - long rebirth text',
		render: () => <ConfirmMenu
			title="Rebirth as Adri?"
			sub={'Adri becomes Adri_old and stays playable and ranked · '
				+ 'The new character starts from zero and unlocks DIVINE'}
			confirmLabel="Rebirth"
			color="#ff4089"
			onConfirm={() => {}}
			onClose={() => {}}
		/>,
	},
	{
		id: 'xp-toggle',
		label: 'Debug XP multiplier',
		render: () => <XpMultiplierToggle />,
	},
];
