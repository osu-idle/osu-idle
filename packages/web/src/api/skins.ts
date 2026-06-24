import {
	apiUrl,
	rpc,
	unwrap,
} from './client';
import type { SkinStatus } from '@osu-idle/shared/skin';

/** Admin: every pending + published add-on for the moderation queue. */
export const listSkinsAdmin = () => unwrap(rpc.v1.skins.admin.$get());

/** One moderation-queue row, inferred from the route. */
export type AdminSkin = Awaited<ReturnType<typeof listSkinsAdmin>>[number];

/** Admin: set an add-on's status */
export const moderateSkin = (
	id: number,
	body: { status: SkinStatus; feedback?: string | null },
) =>
	unwrap(rpc.v1.skins.admin[':id'].$patch({
		param: { id: String(id) }, json: body, 
	}));

/** Resolve a stored icon path to a full URL for an <img>. */
export const skinIconUrl = (icon: string | null): string | undefined =>
	icon ? apiUrl(icon) : undefined;
