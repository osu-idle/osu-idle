import { z } from 'zod';

/**
 * The online play handshake (two HTTP calls):
 *   POST /v1/me/play            → server simulates, returns HitEvents (offsets)
 *   POST /v1/me/play/:token/complete → server persists & returns the final score
 *
 * The server runs the authoritative simulation; the client replays the returned
 * per-input offsets to render an identical play, then signals completion.
 */

export const playRequest = z.object({
	beatmapId: z.number().int(),
	/** carried through only to echo back in the result DTO for display */
	setId: z.number().int(),
});
export type PlayRequest = z.infer<typeof playRequest>;

/** One press/release the server's bot produced. `offset === null` = intentional
 *  miss (ignored input). The client's ReplayBot reproduces these exactly. */
export const replayOffsetDTO = z.object({
	id: z.string(),
	tail: z.boolean(),
	offset: z.number().nullable(),
});
export type ReplayOffsetDTO = z.infer<typeof replayOffsetDTO>;

export const playResponse = z.discriminatedUnion('ranked', [
	// Not a ranked play. `reason` distinguishes the two cases the client must
	// handle differently:
	//  - 'unranked' - the map isn't on the server; play locally, silently.
	//  - 'refused'  - the server declined an otherwise-rankable play (e.g. the
	//                 anti-cheat play lock); surfaced to the player as a dialog.
	z.object({ ranked: z.literal(false), reason: z.enum(['unranked', 'refused']) }),
	z.object({
		ranked: z.literal(true),
		token: z.string(),
		offsets: z.array(replayOffsetDTO),
		/** 1-based input index at which HP hit 0, or null if the play survives */
		failedAt: z.number().int().nullable(),
	}),
]);
export type PlayResponse = z.infer<typeof playResponse>;
