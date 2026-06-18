import { z } from 'zod';

export const playRequest = z.object({
	beatmapId: z.number().int(),
});
export type PlayRequest = z.infer<typeof playRequest>;
