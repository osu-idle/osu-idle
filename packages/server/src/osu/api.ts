import { env } from '../env';

/**
 * Every osu! API call goes through the scheduler (`OSU_API_URL`), never
 * osu.ppy.sh directly: the rate limit is per IP and this host runs several osu!
 * projects, so one shared budget is scheduled in one place.
 *
 * Two token flavours ride the same path - a user's token (the OAuth login) or
 * this app's own client-credentials token, cached here until it expires.
 */

type Priority = 'realtime' | 'interactive' | 'high' | 'normal';

const TOKEN_URL = 'https://osu.ppy.sh/oauth/token';

export class SchedulerError extends Error {}

/** Call an osu! API path (e.g. `api/v2/me`) with an osu! access token. */
export const osuApi = async <T>(path: string, priority: Priority, token: string): Promise<T> => {
	const res = await fetch(`${env.OSU_API_URL}/${path.replace(/^\//, '')}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/json',
			'X-Scheduler-Token': env.OSU_SCHEDULER_TOKEN,
			'X-Osu-Priority': priority,
			'User-Agent': 'osu-idle/1.0',
		},
	});

	// Set only when the request never reached osu!, so it is safe to retry.
	const failed = res.headers.get('x-scheduler-error');
	if (failed) throw new SchedulerError(failed);

	if (!res.ok) throw new Error(`osu! returned ${res.status}`);
	return await res.json() as T;
};

let appToken: { value: string; expiresAt: number } | undefined;

/** This app's client-credentials token (public scope), cached until it expires. */
const getAppToken = async (): Promise<string> => {
	if (appToken && appToken.expiresAt > Date.now()) return appToken.value;

	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json', Accept: 'application/json',
		},
		body: JSON.stringify({
			client_id: env.OSU_CLIENT_ID,
			client_secret: env.OSU_CLIENT_SECRET,
			grant_type: 'client_credentials',
			scope: 'public',
		}),
	});
	if (!res.ok) throw new Error(`osu! client token failed: ${res.status}`);

	const data = await res.json() as { access_token: string; expires_in: number };
	// Expire a minute early so a token can't die mid-flight.
	appToken = {
		value: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 60) * 1000,
	};
	return appToken.value;
};

export type OsuBeatmapsetDiff = {
	id: number;
	mode_int: number;
	cs: number;
	version: string;
	difficulty_rating: number;
};

export type OsuBeatmapset = {
	id: number;
	artist: string;
	title: string;
	creator: string;
	status: string;
	beatmaps?: OsuBeatmapsetDiff[];
};

/** Look a beatmapset up on osu!. Returns undefined when osu! says it's gone. */
export const fetchBeatmapset = async (setId: number): Promise<OsuBeatmapset | undefined> => {
	try {
		return await osuApi<OsuBeatmapset>(
			`api/v2/beatmapsets/${setId}`, 'interactive', await getAppToken(),
		);
	} catch (e) {
		if (e instanceof Error && e.message.includes('404')) return undefined;
		throw e;
	}
};
