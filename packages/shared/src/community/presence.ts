import { z } from 'zod';
import {
	mapped,
	values,
	type ValueIn,
} from '../helpers/mapped.js';
import {
	characterDTO,
	characterStatsDTO,
} from '../character.js';

export const STATUS = mapped(['idle', 'afk', 'playing']);
export type Status = ValueIn<typeof STATUS>;

/** Statuses a client may report for itself. `playing` is server-driven (set
 *  from the authoritative play), never sent by the client. */
export const CLIENT_STATUS = mapped(['idle', 'afk']);
export type ClientStatus = ValueIn<typeof CLIENT_STATUS>;

/** A point on the world map. Coarse, rounded projected coordinates (0..1 of the
 *  map rect) - never raw lat/lng, so a player's real location never leaves the
 *  server. */
export const mapPointDTO = z.object({
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1),
});
export type MapPoint = z.infer<typeof mapPointDTO>;

/** One online character, as broadcast to every connected client. Composed from
 *  the character's identity + headline stats (reused from `character.ts`, not
 *  redeclared) plus the live presence fields (rank, status, location). */
export const presenceEntryDTO = characterDTO
	.pick({
		name: true, avatarUrl: true,
	})
	.extend({
		...characterStatsDTO.shape,
		characterId: z.number().int().positive(),
		country: z.string(),
		rank: z.number().int().min(0).optional(),
		status: z.enum(values(STATUS)),
		nowPlaying: z.string().optional(),
		loc: mapPointDTO.optional(),
		tz: z.string().optional(),
	});
export type PresenceEntry = z.infer<typeof presenceEntryDTO>;
