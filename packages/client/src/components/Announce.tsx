import './Announce.css';
import type { CSSProperties } from 'react';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { getLatest } from '../online/services/news';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { SETTINGS } from '../db/settings';
import { NEWS_TAGS } from '@osu-idle/shared/news';
import { BASE_URL } from '../online/client';
import { updateStatus } from '../online/desktopUpdate';
import { useLingui } from '@lingui/react/macro';

/**
 * Lazer-style announcement toast for the latest news article, sitting at the
 * bottom centre of the main menu. Clicking it opens the article in the in-game
 * web browser; both opening and the ✕ record the article as seen, so it only
 * reappears when something newer is published.
 */
export default function Announce() {
	const { t } = useLingui();

	const [status] = useSynced(updateStatus);
	const latest = useAsync(getLatest, []);
	const [seen] = useSynced(SETTINGS.news);

	/** Don't show the dismissed news */
	if (!latest || latest.id === seen) return;

	const tag = NEWS_TAGS[latest.tag];
	// Cover: custom upload (served by the API) → tag default (a web platform
	// asset) → null, which leaves the tag-hue gradient from the CSS.
	const cover = latest.imageUrl
		? `${BASE_URL}${latest.imageUrl}`
		: tag.image && `/web/news-media/${tag.image}`;
	const date = latest.publishedAt
		? new Date(latest.publishedAt)
			.toLocaleDateString('en-US', {
				month: 'short', day: 'numeric', 
			})
		: '';

	const dismiss = () => SETTINGS.news.set(latest.id);

	const open = async () => {
		window.open(`web/news/${latest.slug}`, '_blank');
	};

	if (status.state !== 'idle' 
		&& status.state !== 'none' 
		&& status.state !== 'checking'
	) return null;

	return (
		<aside className="announce" style={{ '--tag-hue': tag.hue } as CSSProperties}>
			<button 
				className="announce__body"
				onClick={open} 
				title={t`Read the full article`}
			>
				<div
					className="announce__cover"
					style={cover ? { backgroundImage: `url(${cover})` } : undefined}
				/>
				<div className="announce__text">
					<div className="announce__meta">
						<span className="announce__tag">{tag.label}</span>
						{date && <time className="announce__date">{date}</time>}
					</div>
					<div className="announce__heading">
						<span className="announce__title">{latest.title}</span>
						<span className="announce__author">by {latest.authorName}</span>
					</div>
					<span className="announce__summary">{latest.summary}</span>
					<div className="announce__preview">
						{/* `content` is trusted HTML authored by admins - same injection as
						    the web platform's article page. */}
						<div><div
							className="announce__preview-content"
							dangerouslySetInnerHTML={{ __html: latest.content }}
						/></div>
					</div>
				</div>
			</button>
			<button 
				className="announce__close" 
				onClick={dismiss} 
				title={t`Dismiss`}
			>✕</button>
		</aside>
	);
}
