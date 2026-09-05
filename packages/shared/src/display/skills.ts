import {
	__,
	defineMessages,
} from '../i18n/translate.js';
import {
	UPGRADE,
	type SkillName,
} from '../skills.js';

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

/** What a skill's upgrade line is about - the story behind its gear list. */
const UPGRADE_DESCRIPTIONS = defineMessages({
	accuracy: 'Upgrade your keyboard to increase your synergy',
	speed: 'Get accustomed to higher scroll speeds to perform better',
	stamina: 'Build a better warmup routine to endure long maps',
	jackspeed: 'Tune drivers and firmware for faster repeated inputs',
	coordination: 'Try different layouts to increase finger independance',
	release: 'Find the perfect LN skin',
	reading: 'Upgrade your monitor to see the notes more clearly',
	consistency: 'Upgrade your chair to play more comfortably',
	concentration: 'Better audio and less noise to stay locked in',
	speedjam: 'Sharpen your note visuals to survive dense jams',
	memory: 'Change your way of learning SV maps',
} satisfies Record<SkillName, string>);

/** The player-facing, localized description of a skill's upgrade line. */
export function upgradeDescription(skill: SkillName): string {
	return __(UPGRADE_DESCRIPTIONS[skill]);
}

/** Templates dressing the numeric upgrade entries: what the number *is*. */
const UPGRADE_VALUES = defineMessages({
	reading: '{value}hz Monitor',
	speed: '{value} Scroll Speed',
} satisfies Partial<Record<SkillName, string>>);

const TIERS = [
	'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
	'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
];

/** Gear past the base ladder keeps climbing its number instead of repeating a
 *  name. Continues by the ladder's own last step. */
const extrapolate = (ladder: readonly (string | number)[], level: number): number => {
	const top = ladder.length - 1;
	const last = ladder[top] as number;
	const previous = ladder[top - 1] as number;
	return last + (last - previous) * (level - top);
};

/**
 * The player-facing, localized label for a skill's upgrade at `level`. String
 * entries translate by key; numeric ones (scroll speed, monitor hz) fill their
 * skill's template. Past the base ladder a prestige adds gear tiers: the final
 * name repeats with a tier number, while numeric gear just keeps climbing.
 */
export function upgradeLabel(skill: SkillName, level: number): string {
	const ladder = UPGRADE[skill];
	const top = ladder.length - 1;
	const tier = level - top;
	const value = ladder[Math.min(level, top)];
	const template = (UPGRADE_VALUES as Partial<Record<SkillName, string>>)[skill];

	if (typeof value === 'number') {
		const climbed = tier > 0 ? extrapolate(ladder, level) : value;
		return template
			? __(template, undefined, { value: climbed })
			: String(climbed);
	}

	const name = __(value);
	if (tier <= 0) return name;
	// the final ladder entry is itself Tier I, so the first extra slot is Tier II
	return __('{name} Tier {tier}', undefined, {
		name, tier: TIERS[tier] ?? String(tier + 1),
	});
}
