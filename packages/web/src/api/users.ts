import type { UserDTO } from '@osu-idle/shared/user';
import { apiUrl, json, rpc, unwrap } from './client';

/** Public: a single user by id. */
export const getUser = (id: number | string) =>
	unwrap(rpc.v1.users[':id'].$get({ param: { id: String(id) } }));

/** Upload a custom profile picture for the signed-in account; returns the
 *  updated user (with its avatarUrl now pointing at the upload). */
export async function uploadAvatar(file: File): Promise<UserDTO> {
	const form = new FormData();
	form.append('file', file);
	const res = await fetch(apiUrl('/v1/me/avatar'), { method: 'POST', credentials: 'include', body: form });
	return json<UserDTO>(res);
}

/** Remove the custom profile picture, reverting to the osu! avatar. */
export const resetAvatar = () => unwrap(rpc.v1.me.avatar.$delete());
