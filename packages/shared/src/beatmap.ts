/**
 * Beatmap nomination status, shared so the server schema + route validation and
 * the web nomination UI agree on one set of values.
 *
 * - `pending`  uploaded, not scheduled (no rankedAt yet)
 * - `ranked`   scheduled/live - live once rankedAt has passed
 * - `rejected` pulled from the queue
 */
export const BEATMAP_STATUS = ['pending', 'ranked', 'rejected'] as const;
export type BeatmapStatus = (typeof BEATMAP_STATUS)[number];

/**
 * The startup intro set (nekodex - circles!). It's a standard-mode map, not a
 * ranked mania beatmap, so it's the one set ingested regardless of mode and kept
 * out of the website's ranked listings - it's only used for the intro sequence.
 */
export const INTRO_SET_ID = 355322;
