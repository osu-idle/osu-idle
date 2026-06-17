import type { UserDTO } from '@osu-idle/shared/user';
import { BASE_URL, rpc } from './client';
import Synced from '@osu-idle/shared/helpers/synced';

/**
 * Client auth state. The session lives in an HttpOnly cookie set by the API, so
 * nothing is stored here - we just track who the cookie resolves to via /me.
 * Bootstrapping (initial refresh, the login-ping listener) lives in account.ts.
 */
export default class Auth {

	public static readonly user = new Synced<UserDTO | null>(null);

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
		const res = await fetch(`${BASE_URL}/v1/me/avatar`, { method: 'POST', credentials: 'include', body: form });
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
		await Auth.refresh();
	}
}
