import type { NewsCreateBody, NewsUpdateBody } from '@osu-idle/shared/news';
import { apiUrl, json, rpc, unwrap } from './client';

const base = '/v1/news';

/** Resolve a stored media path (e.g. /uploads/x.png) to a loadable URL. Served
 *  by the API, so it's prefixed with the API origin. */
export const mediaUrl = (path: string | null): string | null =>
	!path ? null : apiUrl(path);

/** Admin: upload a cover image, returns the stored path to save as imageUrl. */
export async function uploadNewsImage(file: File): Promise<string> {
	const form = new FormData();
	form.append('file', file);
	const res = await fetch(apiUrl(`${base}/image`), { method: 'POST', credentials: 'include', body: form });
	const data = await json<{ url: string }>(res);
	return data.url;
}

/** Public: published articles, newest first. */
export const listNews = () => unwrap(rpc.v1.news.$get());

/** Public: a single published article by slug. */
export const getNews = (slug: string) => unwrap(rpc.v1.news[':slug'].$get({ param: { slug } }));

/** Admin: every article including drafts. */
export const listAllNews = () => unwrap(rpc.v1.news.admin.$get());

/** Admin: a single article by id (draft or published). */
export const getNewsById = (id: number) => unwrap(rpc.v1.news.admin[':id'].$get({ param: { id: String(id) } }));

/** Format an article timestamp for display; drafts (null) read as "Draft". */
export function formatDate(iso: string | null): string {
	if (!iso) return 'Draft';
	return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const createNews = (body: NewsCreateBody) => unwrap(rpc.v1.news.$post({ json: body }));
export const updateNews = (id: number, body: NewsUpdateBody) =>
	unwrap(rpc.v1.news[':id'].$patch({ param: { id: String(id) }, json: body }));
export const deleteNews = (id: number) => unwrap(rpc.v1.news[':id'].$delete({ param: { id: String(id) } }));
