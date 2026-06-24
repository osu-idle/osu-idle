import {
	useEffect,
	useRef,
} from 'react';
import type { Parallax } from '@osu-idle/shared/hooks/useParallax';

interface Triangle {
	x: number // 0..1 horizontal position
	y: number // pixels from top
	size: number
	speed: number
	depth: number // 0 (far) .. 1 (near) - drives parallax + colour
	spin: number
	rot: number
}

interface Props {
	parallax: Parallax
	/** multiplies triangle drift speed - bumps briefly on each beat */
	intensity?: number
	/** density of triangles */
	count?: number
}

const PINKS = [
	[255, 102, 171],
	[204, 82, 136],
	[255, 166, 208],
	[180, 70, 120],
];

/**
 * The osu! signature: soft triangles slowly drifting upward. Nearer triangles
 * (higher depth) are larger, brighter and react more strongly to parallax.
 */
export default function Triangles({ 
	parallax, 
	intensity = 1, 
	count = 64, 
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const trianglesRef = useRef<Triangle[]>([]);
	const parallaxRef = useRef(parallax);
	const intensityRef = useRef(intensity);
	parallaxRef.current = parallax;
	intensityRef.current = intensity;

	useEffect(() => {
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext('2d')!;
		let raf = 0;
		let w = 0;
		let h = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const resize = () => {
			w = window.innerWidth;
			h = window.innerHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener('resize', resize);

		const spawn = (initial: boolean): Triangle => {
			const depth = Math.random();
			return {
				x: Math.random(),
				y: initial ? Math.random() * h : h + Math.random() * 120,
				size: 24 + depth * 150,
				speed: 14 + depth * 46,
				depth,
				spin: (Math.random() - 0.5) * 0.4,
				rot: Math.random() * Math.PI * 2,
			};
		};

		trianglesRef.current = Array.from({ length: count }, () => spawn(true));

		let last = performance.now();
		const draw = (now: number) => {
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			ctx.clearRect(0, 0, w, h);

			const px = parallaxRef.current.x;
			const py = parallaxRef.current.y;
			const boost = intensityRef.current;

			for (const t of trianglesRef.current) {
				t.y -= t.speed * dt * boost;
				t.rot += t.spin * dt;
				if (t.y + t.size < -40) {
					Object.assign(t, spawn(false));
				}

				// parallax: nearer triangles shift more
				const shift = 40 * t.depth;
				const screenX = t.x * w - px * shift;
				const screenY = t.y - py * shift * 0.6;

				const [r, g, b] = PINKS[Math.floor(t.depth * PINKS.length) % PINKS.length];
				const alpha = 0.05 + t.depth * 0.16;

				ctx.save();
				ctx.translate(screenX, screenY);
				ctx.rotate(t.rot);
				ctx.beginPath();
				const s = t.size;
				// equilateral-ish triangle centred on origin
				ctx.moveTo(0, -s * 0.6);
				ctx.lineTo(s * 0.52, s * 0.4);
				ctx.lineTo(-s * 0.52, s * 0.4);
				ctx.closePath();
				ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
				ctx.fill();
				ctx.restore();
			}

			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);

		return () => {
			window.removeEventListener('resize', resize);
			cancelAnimationFrame(raf);
		};
	}, [count]);

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: 'absolute',
				inset: 0,
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
			}}
		/>
	);
}
