import maxmind, {
	type CityResponse,
	type Reader,
} from 'maxmind';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import type { MapPoint } from '@osu-idle/shared/community/presence';
import { COUNTRY_CENTROIDS } from './countryCentroids';
import { env } from './env';

/**
 * IP geolocation for the community overlay's world map + timezone. Backed by a
 * MaxMind GeoLite2-City database loaded once at boot. Everything degrades
 * gracefully: no DB, an unmatched IP, or a missing field just omits the result -
 * the overlay then falls back to country-level placement.
 *
 * We only ever surface *coarse, rounded* projected coordinates (see {@link project}),
 * never raw lat/lng, so a player's real location never leaves this module.
 */

// World map grid resolution. Coordinates are snapped to a 1/GRID cell so nearby
// players share one anonymous "pink square" and the map dedupes them.
const GRID = 200;

let readerPromise: Promise<Reader<CityResponse> | undefined> | undefined;

const loadReader = (): Promise<Reader<CityResponse> | undefined> => {
	if (!env.GEOIP_DB) return Promise.resolve(undefined);
	readerPromise ??= maxmind.open<CityResponse>(env.GEOIP_DB).catch(err => {
		console.error('GeoIP database failed to load:', (err as Error).message);
		return undefined;
	});
	return readerPromise;
};

/** Equirectangular projection of lat/lng to a rounded point in the map rect (0..1). */
const project = (lat: number, lng: number): MapPoint => {
	const round = (v: number) => Math.round(v * GRID) / GRID;
	return {
		x: round((lng + 180) / 360),
		y: round((90 - lat) / 180),
	};
};

/** The originating client IP: the first `X-Forwarded-For` hop (Apache proxy) or
 *  the direct socket address. */
export const clientIp = (c: Context): string | undefined => {
	const forwarded = c.req.header('x-forwarded-for');
	if (forwarded) return forwarded.split(',')[0].trim();
	return getConnInfo(c).remote.address;
};

export type GeoResult = {
	loc?: MapPoint;
	tz?: string;
};

/**
 * The coarse map point + timezone for an IP. Tries city-level GeoIP first; on any
 * miss (no DB, unmatched / loopback IP) falls back to the account's country
 * centroid so the player still shows up at country granularity. Both paths go
 * through {@link project} (rounded, never raw lat/lng). Empty only if even the
 * country is unknown.
 */
export const geoLookup = async (ip?: string, country?: string): Promise<GeoResult> => {
	const reader = ip ? await loadReader() : undefined;
	const { latitude, longitude, time_zone } = reader?.get(ip!)?.location ?? {};
	if (latitude !== undefined && longitude !== undefined) {
		return {
			loc: project(latitude, longitude), tz: time_zone,
		};
	}

	const centroid = country ? COUNTRY_CENTROIDS[country.toUpperCase()] : undefined;
	return centroid ? { loc: project(centroid.lat, centroid.lng) } : {};
};
