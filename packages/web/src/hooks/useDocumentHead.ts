import { useEffect } from 'react';

const SITE = 'osu!idle';
const ORIGIN = 'https://osu.idle.rhythmgamers.net';

const canonicalLink = () => {
	const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
	if (existing) return existing;
	const link = document.createElement('link');
	link.rel = 'canonical';
	document.head.appendChild(link);
	return link;
};

/**
 * Page titles are authored lowercase for the in-page h1, so capitalise for the
 * tab. An undefined title keeps the one from index.html. Search params are left
 * out of the canonical url on purpose: a paginated ranking is the same page to a
 * crawler.
 */
const useDocumentHead = (title: string | undefined, pathname: string) => {
	useEffect(() => {
		if (title === undefined || title === '') return;
		document.title = `${title[0].toUpperCase()}${title.slice(1)} - ${SITE}`;
	}, [title]);

	useEffect(() => {
		canonicalLink().href = `${ORIGIN}/web${pathname}`;
	}, [pathname]);
};

export default useDocumentHead;
