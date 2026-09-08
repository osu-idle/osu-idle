import { z } from 'zod';

/**
 * Player-submitted ranking propositions - the public front of the nomination
 * queue. A request names one osu! beatmapset; other players back it, and an
 * admin resolves it from the same list (see the server's `beatmap/request`
 * routes).
 *
 * - `pending`   waiting on an admin
 * - `accepted`  the set was ingested (auto-set the moment its `.osz` lands)
 * - `rejected`  turned down, with a reason in `note`
 */
export const BEATMAP_REQUEST_STATUS = ['pending', 'accepted', 'rejected'] as const;
export type BeatmapRequestStatus = (typeof BEATMAP_REQUEST_STATUS)[number];

/** How many open requests one player may hold at once. */
export const MAX_PENDING_REQUESTS = 5;

export const REQUEST_REASON_MAX = 500;

/**
 * Pull a beatmapset id out of what a player pasted: a bare id, or any osu! URL
 * shaped `.../beatmapsets/<id>` (optionally with a `#mania/<diff>` fragment).
 * A difficulty link (`/b/<id>`) can't be resolved without an API call, so it's
 * rejected here rather than guessed at.
 */
export const parseBeatmapsetId = (input: string): number | undefined => {
	const text = input.trim();
	if (/^\d+$/.test(text)) return Number(text);
	const match = /beatmapsets\/(\d+)/.exec(text);
	return match ? Number(match[1]) : undefined;
};

export const beatmapRequestBody = z.object({
	map: z.string().trim().min(1).max(300)
		.refine(v => parseBeatmapsetId(v) !== undefined,
			'Paste a beatmapset link (osu.ppy.sh/beatmapsets/…) or its id',
		),
});
export type BeatmapRequestBody = z.infer<typeof beatmapRequestBody>;

/** Admin resolution: accept or reject, with an optional note shown to everyone. */
export const beatmapRequestPatch = z.object({
	status: z.enum(BEATMAP_REQUEST_STATUS),
	note: z.string().trim().max(REQUEST_REASON_MAX).optional(),
});
export type BeatmapRequestPatch = z.infer<typeof beatmapRequestPatch>;
