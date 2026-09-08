import {
	env,
	OSU_REDIRECT_URI,
} from '../env';
import { osuApi } from '../osu/api';

const AUTHORIZE = 'https://osu.ppy.sh/oauth/authorize';
const TOKEN = 'https://osu.ppy.sh/oauth/token';

export interface OsuUser {
	id: number;
	username: string;
	avatar_url: string | null;
	country_code: string; // ISO 3166-1 alpha-2, e.g. 'FR'
}

/** The osu! authorize URL to redirect the user (popup) to. */
export function authorizeUrl(state: string): string {
	const params = new URLSearchParams({
		client_id: env.OSU_CLIENT_ID,
		redirect_uri: OSU_REDIRECT_URI,
		response_type: 'code',
		scope: 'identify',
		state,
	});
	return `${AUTHORIZE}?${params.toString()}`;
}

/** Exchange an authorization code for an osu! access token. */
export async function exchangeCode(code: string): Promise<string> {
	const res = await fetch(TOKEN, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json', Accept: 'application/json', 
		},
		body: JSON.stringify({
			client_id: env.OSU_CLIENT_ID,
			client_secret: env.OSU_CLIENT_SECRET,
			grant_type: 'authorization_code',
			code,
			redirect_uri: OSU_REDIRECT_URI,
		}),
	});
	if (!res.ok) throw new Error(`osu! token exchange failed: ${res.status} ${await res.text()}`);
	const data = await res.json() as { access_token: string };
	return data.access_token;
}

/** Fetch the authenticated osu! user (scope: identify). Token is used here only. */
export async function fetchOsuUser(accessToken: string): Promise<OsuUser> {
	return osuApi<OsuUser>('api/v2/me', 'interactive', accessToken);
}
