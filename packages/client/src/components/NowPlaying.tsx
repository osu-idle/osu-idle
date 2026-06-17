import './NowPlaying.css';
import { useEffect, useRef } from 'react';
import { music } from '../audio/MusicPlayer';
import useSynced from '@osu-idle/shared/hooks/useSynced';

const BARS = 5;

/** osu!-style bottom music widget: track info, transport and a live visualiser. */
export default function NowPlaying() {
	const [playing = false] = useSynced(music.playing);
	const [beatmap] = useSynced(music.beatmap);
	const barsRef = useRef<HTMLDivElement>(null);

	// drive the bars from the real audio spectrum
	useEffect(() => {
		let raf = 0;
		const draw = () => {
			const el = barsRef.current;
			const spectrum = music.getSpectrum();
			if (el) {
				const children = Array.from(el.children) as HTMLElement[];
				for (let i = 0; i < children.length; i++) {
					// sample low→high bands across the (small) fft
					const v = spectrum ? spectrum[i * 2 + 1] ?? 0 : 0;
					const target = 18 + v * 82;
					const cur = parseFloat(children[i].style.getPropertyValue('--h')) || 18;
					const next = Math.max(target, cur * 0.86); // quick rise, slow fall
					children[i].style.setProperty('--h', `${next}%`);
				}
			}
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<div className="nowplaying">
			<div className="nowplaying__viz" ref={barsRef} data-playing={playing}>
				{Array.from({ length: BARS }, (_, i) => (
					<span key={i} style={{ ['--h' as string]: '20%' }} />
				))}
			</div>

			<button className="nowplaying__play" onClick={() => music.toggle()} aria-label={playing ? 'Pause' : 'Play'}>
				{playing ? (
					<svg viewBox="0 0 24 24" width="20" height="20">
						<rect x="5" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
						<rect x="14.5" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
					</svg>
				) : (
					<svg viewBox="0 0 24 24" width="20" height="20">
						<path d="M6 4l14 8-14 8z" fill="currentColor" />
					</svg>
				)}
			</button>

			<button className="nowplaying__next" onClick={() => music.next()} aria-label="Next track">
				<svg viewBox="0 0 24 24" width="18" height="18">
					<path d="M6 5l10 7-10 7z" fill="currentColor" />
					<rect x="17" y="5" width="3" height="14" rx="1" fill="currentColor" />
				</svg>
			</button>

			<div className="nowplaying__meta">
				<span className="nowplaying__title">{beatmap?.set.metadata.title ?? '--'}</span>
				<span className="nowplaying__artist">{beatmap?.set.metadata.artist ?? '--'}</span>
			</div>
		</div>
	);
}
