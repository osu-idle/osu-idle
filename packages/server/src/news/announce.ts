import {
	NEWS_TAGS,
	type NewsTag,
} from '@osu-idle/shared/news';
import {
	apiBaseUrl,
	clientUrl,
	env,
	isProd,
} from '../env';
import { publish } from '../discord/publish';
import {
	chunkText,
	htmlToMarkdown,
} from '../discord/markdown';
import type { NewsRow } from '../db/schema/news';

/** Discord's own limits: 4096 chars per embed description, 10 embeds and 6000
 *  chars per message. One embed per message keeps both trivially satisfied. */
const CHUNK = 3800;
const MAX_PARTS = 8;

export type AnnounceArticle = Pick<NewsRow,
	'slug' | 'title' | 'summary' | 'content' | 'tag' | 'imageUrl'>;

/** The tag chip's colour on the site (hsl(hue 55% 42%)), as a Discord int. */
const tagColour = (hue: number): number => {
	const [s, l] = [0.55, 0.42];
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - c / 2;
	const [r, g, b] = hue < 60 ? [c, x, 0]
		: hue < 120 ? [x, c, 0]
			: hue < 180 ? [0, c, x]
				: hue < 240 ? [0, x, c]
					: hue < 300 ? [x, 0, c]
						: [c, 0, x];
	const byte = (v: number) => Math.round((v + m) * 255);
	return (byte(r) << 16) + (byte(g) << 8) + byte(b);
};

/** Cover image: the uploaded one (served by the API), else the tag's default
 *  (a static file of the web platform), else none - the embed just has no image. */
const coverUrl = (article: AnnounceArticle, tag: (typeof NEWS_TAGS)[NewsTag]) => {
	if (article.imageUrl) {
		return /^https?:\/\//.test(article.imageUrl)
			? article.imageUrl
			: `${apiBaseUrl}${article.imageUrl}`;
	}
	return tag.image ? `${clientUrl}/web/news-media/${tag.image}` : undefined;
};

/**
 * Post a published article to the news feed: the whole thing, converted to
 * Discord markdown, with the cover and a link back to the site. A long article
 * runs over several embeds (one message each, in order) rather than being cut
 * short. No-op outside prod or without a configured webhook, and the caller
 * claims the announce first so it fires exactly once per article.
 */
export const announceNews = async (
	article: AnnounceArticle, authorName: string,
): Promise<boolean> => {
	if (!isProd || !env.NEWS_FEED_WEBHOOK) return true;

	const tag = NEWS_TAGS[article.tag as NewsTag] ?? NEWS_TAGS.update;
	const url = `${clientUrl}/web/news/${article.slug}`;
	const colour = tagColour(tag.hue);

	const image = coverUrl(article, tag);
	const body = htmlToMarkdown(article.content);
	const parts = chunkText(`*${article.summary}*\n\n${body}`, CHUNK);
	const kept = parts.slice(0, MAX_PARTS);
	// Whatever didn't fit stays one click away.
	const cut = parts.length > MAX_PARTS ? '\n\n…' : '';
	kept[kept.length - 1] += `${cut}\n\n[Read it on the website](${url})`;

	let sent = true;
	for (const [i, part] of kept.entries()) {
		sent = await publish(env.NEWS_FEED_WEBHOOK, {
			embeds: [{
				// Only the opening embed carries the heading and the cover, so the
				// rest read as one continuous article.
				...(i === 0 ? {
					author: { name: tag.label },
					title: article.title,
					url,
					...(image ? { image: { url: image } } : {}),
					footer: { text: `by ${authorName}` },
					timestamp: new Date().toISOString(),
				} : {}),
				description: part,
				color: colour,
			}],
		});
		// A rejected part means the rest would land out of context: stop there.
		if (!sent) break;
	}
	return sent;
};
