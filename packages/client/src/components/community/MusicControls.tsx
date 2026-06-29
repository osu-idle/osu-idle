import './MusicControls.css';
import {
	useEffect,
	useRef,
	useState,
} from 'react';
import { useLingui } from '@lingui/react/macro';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { music } from '../../audio/MusicPlayer';

/**
 * The overlay's "Now playing" widget, modelled on osu!stable's music controller:
 * the track's `artist - title`, a previous / play-pause / stop / next transport,
 * and a scrubable progress bar. Drives the {@link music} engine directly.
 */
export default function MusicControls() {
	const { t } = useLingui();
	const [beatmap] = useSynced(music.beatmap);
	const [playing = false] = useSynced(music.playing);
	const [progress, setProgress] = useState(0);
	const barRef = useRef<HTMLDivElement>(null);

	const duration = beatmap?.metadata.total_length ?? 0;

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			if (duration > 0) {
				setProgress(Math.min(1, Math.max(0, music.time() / duration)));
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [duration]);

	const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
		const rect = barRef.current?.getBoundingClientRect();
		if (!rect || duration <= 0) return;
		const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
		music.seek(fraction * duration);
		setProgress(fraction);
	};

	return (
		<div className="community-music">
			<div className="community-music__meta">
				<span className="community-music__label">{t`Now playing`}</span>
				<span className="community-music__title">
					{beatmap
						? `${beatmap.set.metadata.artist} - ${beatmap.set.metadata.title}`
						: '—'}
				</span>
			</div>

			<div className="community-music__transport">
				<button onClick={() => void music.previous()} aria-label={t`Previous`}>
					<svg viewBox="0 0 24 24" width="24" height="24">
						<rect x="5" y="5" width="2.5" height="14" rx="1" fill="currentColor" />
						<path d="M20 5 9 12l11 7z" fill="currentColor" />
					</svg>
				</button>
				<button onClick={() => music.toggle()} aria-label={playing ? t`Pause` : t`Play`}>
					{playing ? (
						<svg viewBox="0 0 24 24" width="26" height="26">
							<rect x="5" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
							<rect x="14.5" y="4" width="4.5" height="16" rx="1" fill="currentColor" />
						</svg>
					) : (
						<svg viewBox="0 0 24 24" width="26" height="26">
							<path d="M6 4l14 8-14 8z" fill="currentColor" />
						</svg>
					)}
				</button>
				<button onClick={() => music.stop()} aria-label={t`Stop`}>
					<svg viewBox="0 0 24 24" width="24" height="24">
						<rect x="5" y="5" width="14" height="14" rx="1.5" fill="currentColor" />
					</svg>
				</button>
				<button onClick={() => void music.next()} aria-label={t`Next`}>
					<svg viewBox="0 0 24 24" width="24" height="24">
						<path d="M4 5l11 7-11 7z" fill="currentColor" />
						<rect x="16.5" y="5" width="2.5" height="14" rx="1" fill="currentColor" />
					</svg>
				</button>
			</div>

			<div className="community-music__bar" ref={barRef} onClick={scrub}>
				<div className="community-music__fill" style={{ width: `${progress * 100}%` }} />
			</div>
		</div>
	);
}
