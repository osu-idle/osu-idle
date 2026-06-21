import { __, defineMessages } from '../i18n/translate.js';
import { UPGRADE, type SkillName } from '../skills.js';

// Display names live here, deliberately apart from skills.ts - that file owns
// the enum keys the sim/scoring branch on (logic), this owns how they read to a
// player (display). `defineMessages` makes the extractor collect each literal
// into the shared catalog; `__` then resolves by key at render time.
const SKILL_NAMES = defineMessages({
	accuracy: 'Accuracy',
	speed: 'Speed',
	stamina: 'Stamina',
	coordination: 'Coordination',
	consistency: 'Consistency',
	jackspeed: 'Jack Speed',
	reading: 'Reading',
	memory: 'Memory',
	concentration: 'Concentration',
	release: 'Release',
	speedjam: 'Speed Jam',
	overall: 'Overall',
} satisfies Record<SkillName & 'overall', string>);

/** The player-facing, localized name of a skill. */
export function skillName(skill: SkillName | 'overall'): string {
	return __(SKILL_NAMES[skill]);
}

/**
 * The player-facing, localized label for a skill's upgrade at `level` (0..10).
 * String entries translate by key; numeric ones (scroll speed, monitor hz) are
 * language-neutral and just stringified.
 */
export function upgradeLabel(skill: SkillName, level: number): string {
	const value = UPGRADE[skill][level];
	return typeof value === 'number' ? String(value) : __(value);
}
