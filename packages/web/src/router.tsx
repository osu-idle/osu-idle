import { useEffect, useState } from 'react';
import { SkillSort } from './components/leaderboard/PlayerSkillLeaderboard';

/** The web platform is mounted under this base path (matches vite `base`). */
export const HOME = '/web';

export const Asset = (url: string) => url.startsWith('/') ? `${HOME}${url}` : url;

export const ROUTE = {
	LANDING: '',
	HOME: '/',
	NEWS: '/news',
	NEWS_ADMIN: '/news/admin',
	DOWNLOAD: '/download',

	LOGIN: '/login',
	LOGOUT: '/logout',

	BEATMAP_LISTING: '/maps/:sort/:dir',

	RANKINGS_GLOBAL: '/rankings/global',
	RANKINGS_GLOBAL_SCORE: '/rankings/score',
	RANKINGS_GLOBAL_COUNTRY: '/rankings/country/:country',
	RANKINGS_GLOBAL_SCORE_COUNTRY: '/rankings/score/country/:country',
	RANKINGS_COUNTRY: '/rankings/country',
	RANKINGS_PLAYS: '/rankings/plays',
	RANKINGS_SKILLS: '/rankings/skills/:skill/page/:page',
	RANKINGS_SKILLS_COUNTRY: '/rankings/skills/:skill/country/:country/page/:page',

	NEWS_ARTICLE: '/news/:slug',
	CHARACTER_PAGE: '/c/:id',

	HELP_FAQ: '/help/faq',

	AUTH_CALLBACK: '/auth/callback',
	AUTH_DESKTOP: '/auth/desktop',
	AUTH_ERROR: '/auth/error',

	ADMIN_BALANCING: '/admin/balancing',
} as const;
export type Route = keyof typeof ROUTE;
export type Path = (typeof ROUTE)[Route];

export const newsArticlePath = (slug: string) => `${ROUTE.NEWS}/${slug}` as Path;
export const characterPath = (id: string | number) => `/c/${id}` as Path;
export const beatmapListing = (sort?: string, dir?: string) => `/maps/${sort ?? 'date'}/${dir ?? 'desc'}` as Path;
export const globalCountryRankPath = (country: string | number) => `/rankings/country/${country}` as Path;
export const globalScoreCountryRankPath = (country: string | number) => `/rankings/score/country/${country}` as Path;
export const globalSkillRankPath = (skill: SkillSort, page: number) => `/rankings/skills/${skill}/page/${page}` as Path;
export const countrySkillRankPath = (skill: SkillSort, country: string, page: number) => `/rankings/skills/${skill}/country/${country}/page/${page}` as Path;

/** Dynamic-segment values extracted from a path (e.g. { id: '42' }). */
export type Params = Record<string, string>;

/** Props every page receives; dynamic pages read their segments off params. */
export interface PageProps {
	current: Path;
	params: Params;
}

/** Result of resolving a concrete path against the ROUTE patterns. */
export interface Match {
	route: Path;
	params: Params;
}

/** Resolve a concrete (HOME-stripped) path to its ROUTE pattern plus any
 * extracted params. Static routes are tried before dynamic (`:param`) ones, so
 * /news/admin wins over /news/:slug. Falls back to HOME when nothing matches. */
export function matchRoute(path: string): Match {
	const routes = Object.values(ROUTE) as Path[];

	// Exact (static) routes first.
	for (const route of routes) {
		if (!route.includes(':') && route === path) return { route, params: {} };
	}

	// Dynamic routes (e.g. /c/:id).
	const segments = path.split('/');
	for (const route of routes) {
		if (!route.includes(':')) continue;
		const parts = route.split('/');
		if (parts.length !== segments.length) continue;

		const params: Record<string, string> = {};
		let matched = true;
		for (let i = 0; i < parts.length; i++) {
			if (parts[i].startsWith(':')) params[parts[i].slice(1)] = segments[i];
			else if (parts[i] !== segments[i]) { matched = false; break; }
		}
		if (matched) return { route, params };
	}

	return { route: ROUTE.HOME, params: {} };
}

/** Strip the HOME base prefix from a concrete pathname. */
function stripHome(path: string): string {
	return HOME && path.startsWith(HOME) ? path.slice(HOME.length) : path;
}

/** Current route path, normalised (no trailing slash; bare base → HOME). */
export function currentPath(): string {
	return window.location.pathname.replace(/\/+$/, '') || HOME;
}

/** Navigation: client-side by default; pass refresh to do a full page load. */
export function navigate(to: Path, refresh: boolean = false): void {
	const link = `${HOME}${to}`;
	if (refresh) {
		window.location.assign(link);
		return;
	}
	if (link === currentPath()) return;
	window.history.pushState({}, '', link);
	window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Subscribe a component to the current route path. */
export function usePath(): string {
	const [path, setPath] = useState(currentPath());

	useEffect(() => {
		const onPop = () => setPath(currentPath());
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	return path;
}

/** Parsed query string (GET params) of the current URL. */
export function queryParams(): URLSearchParams {
	return new URLSearchParams(window.location.search);
}

/** Read a single query param from the current URL (e.g. ?page=2 → '2', or null). */
export function queryParam(name: string): string | null {
	return queryParams().get(name);
}

/** Subscribe a component to a single query param, re-rendering when it changes. */
export function useQueryParam(name: string): string | null {
	const [value, setValue] = useState(() => queryParam(name));

	useEffect(() => {
		const onPop = () => setValue(queryParam(name));
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, [name]);

	return value;
}

/** Subscribe a component to the resolved route pattern + params for the URL. */
export function useMatch(): Match {
	return matchRoute(stripHome(usePath()));
}

export function useRoute(): Path {
	return useMatch().route;
}
