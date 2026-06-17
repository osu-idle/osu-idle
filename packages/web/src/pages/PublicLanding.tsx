import './PublicLanding.css';

import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord } from '@fortawesome/free-brands-svg-icons';
import type { NewsDTO } from '@osu-idle/shared/news';

import { Asset, ROUTE } from '../router';
import { loginWithOsu } from '../auth';
import { listNews } from '../api/news';
import Link from '../components/Link';
import NewsCard, { articleToCard } from '../components/NewsCard';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { getGeneralStats } from '../api/stats';

function formatCount(n: number): string {
	return n.toLocaleString('en-US');
}

export default function PublicLanding() {
	const [articles, setArticles] = useState<NewsDTO[] | null>(null);
	useEffect(() => {
		listNews().then(setArticles).catch(() => setArticles([]));
	}, []);
	const live = articles && articles.length > 0 ? articles.slice(0, 3) : null;
	const stats = useAsync(getGeneralStats, []);

	const STATS = [
		{ label: 'scores set', value: stats?.scores ?? 0 },
		{ label: 'characters', value: stats?.users ?? 0 },
		{ label: 'online now', value: stats?.online ?? 0 },
		{ label: 'playing now', value: stats?.playing ?? 0 },
	] as const;

	return (
		<div className="landing">
			<div className="landing__glow" aria-hidden="true" />

			<header className="landing__topbar">
				<div className="landing__brand">
					<span className="landing__brand-logo" />
					<span className="landing__brand-name">osu!<b>idle</b></span>
				</div>
				<nav className="landing__topnav">
					<a href="https://discord.gg/Yd5GEaX8AJ" target="_blank" rel="noopener noreferrer" className="landing__topnav-link">
						<FontAwesomeIcon icon={faDiscord} />
					</a>
					<button type="button" className="landing__signin" onClick={loginWithOsu}>
						Sign in
					</button>
				</nav>
			</header>

			<section className="hero">
				<video
					className="hero__video"
					src={Asset('/intro.mp4')}
					autoPlay
					muted
					loop
					playsInline
				/>
				<div className="hero__scrim" aria-hidden="true" />

				<div className="hero__content">
					<div className="hero__logo">
						<img className="hero__logo-back" src={Asset('/idle-back.png')} alt="" aria-hidden="true" />
						<img className="hero__logo-front" src={Asset('/idle-white.png')} alt="osu!idle" />
					</div>
					<h1 className="hero__title">The ultimate<br/>osu!mania idle game</h1>
					<p className="hero__tagline">
						Create your own osu! character and watch it grow to become a<br /><b>legendary mania player</b>.
					</p>
					<div className="hero__cta">
						<button type="button" className="btn-osu" onClick={loginWithOsu}>
							<img src={Asset('/idle.png')} alt="" aria-hidden="true" />
							Sign in with osu!
						</button>
						<a className="btn-ghost" href="https://discord.gg/Yd5GEaX8AJ" target="_blank" rel="noopener noreferrer">
							Join the community
						</a>
					</div>

					<ul className="stats">
						{STATS.map(s => (
							<li key={s.label} className="stats__item">
								<span className="stats__value">{formatCount(s.value)}</span>
								<span className="stats__label">{s.label}</span>
							</li>
						))}
					</ul>
				</div>
			</section>

			<section className="news">
				<div className="news__head">
					<h2 className="news__heading">Latest news</h2>
					<Link to={ROUTE.NEWS} className="news__all">View all →</Link>
				</div>
				<div className="news-grid">
					{live && live.map(a => <NewsCard key={a.id} {...articleToCard(a)} />)}
					{!live && 'No news yet. Check back soon!'}
				</div>
			</section>

			<footer className="landing__footer">
				<nav className="landing__footer-links">
					<a href="https://discord.gg/Yd5GEaX8AJ" target="_blank" rel="noopener noreferrer">
						<FontAwesomeIcon icon={faDiscord} /> Discord
					</a>
				</nav>
				<span className="landing__footer-note">
					An unofficial fan project. Not affiliated with osu! or ppy.
				</span>
			</footer>
		</div>
	);
}
