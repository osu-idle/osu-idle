import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

export const RULESET = mapped(['OSU', 'TAIKO', 'CATCH', 'MANIA']);
export type Ruleset = ValueIn<typeof RULESET>;

export const RULESET_ID = {
	[RULESET.OSU]: 0,
	[RULESET.TAIKO]: 1,
	[RULESET.CATCH]: 2,
	[RULESET.MANIA]: 3,
} as const;
export type RulesetId = ValueIn<typeof RULESET_ID>;