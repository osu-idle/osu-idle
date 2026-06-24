import type { UserDTO } from '@osu-idle/shared/user';
import {
	BASE_URL,
	rpc,
	withAuth,
} from './client';
import Synced from '@osu-idle/shared/helpers/synced';
import { desktop } from '@osu-idle/shared/desktop';
import {
	isWebOpen,
	webUrl,
} from '../globals';

/**
 * Client auth state. The session lives in an HttpOnly cookie set by the API, so
 * nothing is stored here - we just track who the cookie resolves to via /me.
 * Bootstrapping (initial refresh, the login-ping listener) lives in account.ts.
 */
export default class Auth {

	public static readonly user = new Synced<UserDTO | null>(null);

	/** Begin sign-in. Desktop runs the native OAuth flow (system browser → token
	 *  pushed back over the bridge); in a browser we open the in-game web platform
	 *  on its login page, which handles the popup/redirect off the shared cookie. */
	public static signIn(): void {
		const app = desktop();
		if (app) {
			void app.login().catch(err => console.warn('[auth] desktop login failed', err));
			return;
		}
		void webUrl.set('login');
		void isWebOpen.set(true);
	}

	/** Re-check the session against the API. */
	public static async refresh(): Promise<void> {
		try {
			const res = await rpc.v1.auth.me.$get();
			Auth.user.set(res.ok ? await res.json() : null);
		} catch {
			Auth.user.set(null);
		}
	}

	/**
	 * Upload a custom profile picture for the signed-in account, replacing the
	 * osu! avatar. Updates {@link user} from the server's response so the new
	 * picture shows everywhere immediately.
	 */
	public static async uploadAvatar(file: File): Promise<void> {
		const form = new FormData();
		form.append('file', file);
		const res = await fetch(`${BASE_URL}/v1/me/avatar`, withAuth({ 
			method: 'POST',
			body: form, 
		}));
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new Error(`avatar upload failed (${res.status})${detail ? `: ${detail}` : ''}`);
		}
		Auth.user.set(await res.json() as UserDTO);
	}

	public static async signOut(): Promise<void> {
		try {
			await rpc.v1.auth.logout.$post();
		} catch { /* ignore */ }
		// desktop holds the session itself (no server cookie to clear) - drop it
		// so the Bearer header stops being sent and we fall back to guest.
		await desktop()?.logout();
		await Auth.refresh();
	}
}
