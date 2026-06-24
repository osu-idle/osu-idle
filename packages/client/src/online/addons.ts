import type { InferResponseType } from 'hono/client';
import type {
	AddonCreateBody,
	AddonUpdateBody,
} from '@osu-idle/shared/addon';
import {
	BASE_URL,
	rpc,
	withAuth,
} from './client';

/** One catalog/own add-on as it crosses the wire, inferred from the route. */
export type Addon = InferResponseType<typeof rpc.v1.addons[':id']['$get']>;

type Resp = { ok: boolean; status: number; json: () => Promise<unknown> };

/** Await a request and throw the server's error on a non-2xx, else return the JSON. */
const unwrap = async <T>(p: Promise<Resp>): Promise<T> => {
	const res = await p;
	if (!res.ok) {
		const body = await res.json().catch(() => ({})) as { error?: string };
		throw new Error(body.error ?? `Request failed (${res.status})`);
	}
	return res.json() as Promise<T>;
};

export const addonIconUrl = (
	icon: string | null | undefined,
): string | undefined =>
	icon ? (/^https?:\/\//.test(icon) ? icon : `${BASE_URL}${icon}`) : undefined;

type BrowseQuery = { 
	q?: string,
	tag?: string, 
	sort?: 'created' | 'updated', 
	dir?: 'asc' | 'desc',
};

/** Public: browse the published catalog. */
export const browseAddons = (query: BrowseQuery = {}) =>
	unwrap<Addon[]>(rpc.v1.addons.$get({ query }));

/** Public: a single published add-on (incl source, for install). */
export const getAddon = (id: number) =>
	unwrap<Addon>(rpc.v1.addons[':id'].$get({ param: { id: String(id) } }));

/** Auth: the caller's own add-ons (any status). */
export const myAddons = () =>
	unwrap<Addon[]>(rpc.v1.addons.me.$get());

/** Auth: create a draft add-on. */
export const createAddon = (json: Partial<AddonCreateBody>) =>
	unwrap<Addon>(rpc.v1.addons.$post({ json: json as AddonCreateBody }));

/** Auth+owner: edit an add-on. */
export const updateAddon = (id: number, json: AddonUpdateBody) =>
	unwrap<Addon>(rpc.v1.addons[':id'].$patch({
		param: { id: String(id) }, json, 
	}));

/** Auth+owner: submit a draft/denied add-on for review. */
export const submitAddon = (id: number) =>
	unwrap<Addon>(rpc.v1.addons[':id'].submit.$post({ param: { id: String(id) } }));

/** Auth+owner: delete an add-on. */
export const deleteAddon = (id: number) =>
	unwrap<{ ok: boolean }>(rpc.v1.addons[':id']
		.$delete({ param: { id: String(id) } }));

/** Auth: upload an icon image, returning its stored public path. */
export const uploadAddonIcon = async (file: File): Promise<string> => {
	const form = new FormData();
	form.append('file', file);
	const res = fetch(`${BASE_URL}/v1/addons/icon`,
		withAuth({
			method: 'POST', body: form, 
		}),
	);
	return (await unwrap<{ url: string }>(res)).url;
};
