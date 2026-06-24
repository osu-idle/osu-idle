/** The web platform is mounted under this base path (matches vite `base`). */
export const HOME = '/web';

/** Resolve a public asset URL under the platform base (routes go through Link). */
export const Asset = (url: string) => url.startsWith('/') ? `${HOME}${url}` : url;
