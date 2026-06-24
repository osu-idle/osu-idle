import './NewsCard.css';

import {
	NEWS_TAGS,
	type NewsTag,
	type NewsDTO,
} from '@osu-idle/shared/news';
import Link from './Link';
import {
	formatDate,
	mediaUrl,
} from '../api/news';
import { Asset } from '../router';

export interface NewsCardData {
	slug: string;
	tag: string;
	hue: number;
	image?: string | null;
	date: string;
	title: string;
	blurb: string;
	className?: string;
}

/**
 * Default cover image per tag, used when an article has no custom upload. The
 * tag → filename mapping lives in shared `NEWS_TAGS`; the files themselves are
 * in `packages/web/public/news-media/`. (Kept out of the `/news` path so they
 * can't shadow the SPA route.)
 */
const tagImage = (file: string | null) => (file ? Asset(`/news-media/${file}`) : null);

/** A tag-coloured gradient, used as the cover when no image is available. */
export const tagGradient = (hue: number) =>
	`linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 60% 30%))`;

/** Resolve an article's cover: custom upload → tag default image → null (the
 *  caller then uses the tag gradient). */
export function coverImage(a: { imageUrl: string | null; tag: NewsTag }): string | null {
	return mediaUrl(a.imageUrl) ?? tagImage(NEWS_TAGS[a.tag].image);
}

/** Map a real article to the card's presentational shape: tag drives the colour
 *  and the cover falls back to the tag default/gradient when there's no upload. */
export function articleToCard(a: NewsDTO): NewsCardData {
	const t = NEWS_TAGS[a.tag];
	return {
		slug: a.slug,
		tag: t.label,
		hue: t.hue,
		image: coverImage(a),
		date: formatDate(a.publishedAt),
		title: a.title,
		blurb: a.summary,
	};
}

/** The shared news card - one display reused by the landing, dashboard and news
 *  list. Purely presentational; callers map their data to NewsCardData. */
export default function NewsCard({ 
	slug, 
	tag,
	hue,
	image,
	date, 
	title,
	blurb,
	className, 
}: NewsCardData) {
	return (
		<Link to="/news/$slug" params={{ slug }} className={`news-card ${className ?? ''}`}>
			<div
				className="news-card__cover"
				style={image ? { backgroundImage: `url(${image})` } : { background: tagGradient(hue) }}
			>
				<span className="news-card__tag" style={{ background: `hsl(${hue} 55% 42%)` }}>{tag}</span>
			</div>
			<div className="news-card__body">
				<time className="news-card__date">{date}</time>
				<div className='news-card__meta'>
					<h3 className="news-card__title">{title}</h3>
					<p className="news-card__blurb">{blurb}</p>
				</div>
			</div>
		</Link>
	);
}
