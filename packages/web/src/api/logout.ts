import { desktop } from '@osu-idle/shared/desktop';
import { rpc } from './client';

/** Sign out: clear the server cookie and, on desktop, drop the held Bearer token
 *  so the app stops authenticating as the account. */
export const logout = async () => {
	const res = await rpc.v1.auth.logout.$post();
	await desktop()?.logout();
	return res;
};
