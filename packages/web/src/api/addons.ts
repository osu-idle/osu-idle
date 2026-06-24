import {
	apiUrl,
	rpc,
	unwrap,
} from './client';
import type { AddonStatus } from '@osu-idle/shared/addon';

/** Admin: every pending + published add-on for the moderation queue. */
export const listAddonsAdmin = () => unwrap(rpc.v1.addons.admin.$get());

/** One moderation-queue row, inferred from the route. */
export type AdminAddon = Awaited<ReturnType<typeof listAddonsAdmin>>[number];

/** Admin: set an add-on's status and optionally leave feedback. */
export const moderateAddon = (
	id: number,
	body: { status: AddonStatus; feedback?: string | null },
) =>
	unwrap(rpc.v1.addons.admin[':id'].$patch({
		param: { id: String(id) }, json: body, 
	}));

/** Resolve a stored icon path to a full URL for an <img>. */
export const addonIconUrl = (icon: string | null): string | undefined =>
	icon ? apiUrl(icon) : undefined;
