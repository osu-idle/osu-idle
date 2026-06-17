import { useEffect, useRef, useState } from 'react';
import { music } from '../audio/MusicPlayer';
import { logoPulse } from './logoPulse';
import './OsuLogo.css';

interface Props {
	size?: number
	onClick?: () => void
}

/**
 * The osu! logo. It continuously "breathes" and snaps a little larger on every
 * musical beat (via the player's beat listener), like the real menu logo reacting to the
 * current track. Hovering swells it; clicking triggers a ripple and onClick.
 */
export default function OsuLogo({ size = 380, onClick }: Props) {
	const wrapRef = useRef<HTMLDivElement>(null);
	const overlayRef = useRef<HTMLImageElement>(null);
	const energy = useRef(0); // decays after each beat
	const beatInterval = useRef(0.5); // measured seconds between beats - paces the decay
	const hover = useRef(0); // eases toward hover target
	const hoverTarget = useRef(0);
	const [ripples, setRipples] = useState<number[]>([]);

	// snap larger on every musical beat of the current track, measuring the tempo so the
	// kick can ease back over a full beat rather than a fixed (tempo-blind) number of frames
	useEffect(() => {
		let last = 0;
		return music.listeners.beat.on(() => {
			const now = performance.now();
			if (last) beatInterval.current = (now - last) / 1000;
			last = now;
			energy.current = 1;
		});
	}, []);

	useEffect(() => {
		let raf = 0;
		const start = performance.now();
		let prev = start;
		const loop = (now: number) => {
			const t = (now - start) / 1000;
			const dt = Math.min(0.05, (now - prev) / 1000); // clamp big gaps (tab was hidden)
			prev = now;
			// ease the kick back to rest over (roughly) one full beat, so the pulse breathes
			// in time with the song instead of snapping back in a fixed handful of frames
			energy.current *= Math.pow(0.04, dt / beatInterval.current);
			hover.current += (hoverTarget.current - hover.current) * 0.12;

			const breathe = Math.sin(t * 1.6) * 0.012;
			const beat = energy.current * 0.09;
			const hov = hover.current * 0.25;
			const scale = 1.2 + breathe + beat + hov;
			const maxScale = 1.2 + breathe + 0.02 + hov;

			logoPulse.scale = scale; // share with the waveform halo

			if (wrapRef.current) {
				wrapRef.current.style.transform = `scale(${scale})`;
			}

			if (overlayRef.current) {
				overlayRef.current.style.transform = `scale(${maxScale})`;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);

	const handleClick = () => {
		const id = Date.now();
		setRipples((r) => [...r, id]);
		setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 650);
		onClick?.();
	};

	return (
		<div
			className="main-logo"
			style={{ width: size, height: size }}
			onClick={handleClick}
			onPointerEnter={() => (hoverTarget.current = 1)}
			onPointerLeave={() => (hoverTarget.current = 0)}
			aria-label="osu! logo"
		>
			<div className="main-logo__pulse" ref={wrapRef}>
				<img src="/osu-logo.png" alt="osu!" draggable={false} />
			</div>
			<img className='main-logo__overlay' src="/osu-logo.png" alt="osu!" ref={overlayRef} draggable={false} />
			{ripples.map((id) => (
				<span key={id} className="main-logo__ripple" />
			))}
		</div>
	);
}
