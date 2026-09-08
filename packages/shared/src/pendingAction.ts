import { z } from 'zod';
import { Skills } from './skills.js';

/**
 * A character action a running play deferred. A play's outcome and its xp are
 * both decided when it starts, so anything that rewrites progression waits for
 * it to end rather than racing its finalise.
 *
 * They stack, and they are committed: buying during a play is a purchase, not a
 * proposal. Each one is still checked when it is applied, so an action the
 * character can no longer afford by the time its turn comes is simply dropped.
 */
export const pendingActionDTO = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('upgrade'),
		skill: z.enum(Skills),
		requestedAt: z.number().int(),
	}),
	z.object({
		type: z.literal('prestige'),
		skill: z.enum(Skills),
		requestedAt: z.number().int(),
	}),
	z.object({
		type: z.literal('rebirth'),
		name: z.string(),
		requestedAt: z.number().int(),
	}),
]);
export type PendingAction = z.infer<typeof pendingActionDTO>;
