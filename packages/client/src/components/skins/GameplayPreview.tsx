import {
	useEffect,
	useRef,
	useState,
} from 'react';
import { Trans } from '@lingui/react/macro';
import { Beatmap } from 'osu-classes';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import CharacterBot from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import { scrollSpeedToMs } from '@osu-idle/shared/osu/scroll_speed';
import { type Grade } from '@osu-idle/shared/judgement';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import { music } from '../../audio/MusicPlayer';
import { SETTINGS } from '../../db/settings';
import { DEBUG_BOT_LEVEL } from '../../gameplay/strainDebug';
import GameplayRenderer, { strainLabels } from '../../gameplay/gameplayRenderer';
import BeatmapStore from '../../osu/beatmap/beatmap_store';
import Skin, { validateSkinSource } from '../../osu/skin/Skin';

/** parse a skin source, or undefined when it isn't valid yet (mid-edit) */
const safeSkin = (source: string): Skin | undefined => {
	try {
		return validateSkinSource(source) ? undefined : new Skin(JSON.parse(source));
	} catch {
		return undefined;
	}
};

/**
 * A silent full-gameplay preview of the currently playing beatmap, synced to the
 * live music position, drawn with the given skin source so an author sees every
 * skinnable element - notes, receptors, HP bar, hit-error bar, strain gauges,
 * judgements, grade - in motion. Reuses the gameplay GameplayRenderer and a
 * debug-level bot; no audio of its own, scoring submit, or server session.
 */
export default function GameplayPreview({ definition }: { definition: string }) {
	const [beatmapInfo] = useSynced(music.beatmap);
	const [dim] = useSynced(SETTINGS.backgroundDim);
	// last valid skin (kept across invalid mid-edit states) - drives the renderer
	// and the DOM grade badge
	const [skin, setSkin] = useState(() => safeSkin(definition) ?? new Skin());
	const [grade, setGrade] = useState<Grade>('X');

	const wrapRef = useRef<HTMLDivElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<GameplayRenderer | null>(null);
	const skinRef = useRef(skin);
	skinRef.current = skin;

	useEffect(() => {
		const s = safeSkin(definition);
		if (s) setSkin(s);
	}, [definition]);

	useEffect(() => {
		rendererRef.current?.setSkin(skin);
	}, [skin]);

	useEffect(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap || !beatmapInfo) return;
		const ctx = canvas.getContext('2d')!;

		let raf = 0;
		let alive = true;
		let ro: ResizeObserver | undefined;
		let bgUrl: string | undefined;
		void (async () => {
			let beatmap: Beatmap;
			try {
				beatmap = await beatmapInfo.load();
			} catch {
				return;
			}
			if (!alive || beatmap.hitObjects.length === 0) return;

			// a debug-level bot plays the map so notes get hit and the HUD comes alive;
			// building the game runs its strain analysis, so bot.strainsAt feeds the gauges
			const bot = new CharacterBot(
				makeOrderedSkills(DEBUG_BOT_LEVEL),
				beatmap.difficulty.overallDifficulty,
			);
			const game = new ManiaGame(beatmap, bot, { noFail: true });
			const renderer = new GameplayRenderer(ctx, game, skinRef.current);
			rendererRef.current = renderer;
			const labels = strainLabels();

			void BeatmapStore.getBeatmapBackground(beatmap).then(url => {
				if (!alive || !url) return;
				bgUrl = url;
				if (bgRef.current) bgRef.current.style.backgroundImage = `url("${url}")`;
			});

			const scrollMs = scrollSpeedToMs(SETTINGS.scrollspeed.get());
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			let w = 0;
			let h = 0;
			const resize = () => {
				w = wrap.clientWidth;
				h = wrap.clientHeight;
				canvas.width = w * dpr;
				canvas.height = h * dpr;
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			};
			resize();
			ro = new ResizeObserver(resize);
			ro.observe(wrap);

			const draw = () => {
				// follow the live music position so the notes stay synced to the track
				// (it loops / advances on its own; a backward jump rewinds the sim)
				const now = Math.max(0, music.time());
				if (now < game.now()) game.seek(now);
				else game.update(now);
				const vp = {
					w,
					h,
					scrollMs,
				};
				renderer.clear(vp);
				renderer.draw(now, vp, {
					strain: {
						bot,
						labels,
					},
					onGrade: setGrade,
				});
				raf = requestAnimationFrame(draw);
			};
			raf = requestAnimationFrame(draw);
		})();

		return () => {
			alive = false;
			cancelAnimationFrame(raf);
			ro?.disconnect();
			rendererRef.current = null;
			if (bgUrl) URL.revokeObjectURL(bgUrl);
		};
	}, [beatmapInfo]);

	if (!beatmapInfo) {
		return (
			<div className='skin-preview skin-preview--empty'>
				<Trans>Play a beatmap to preview the skin.</Trans>
			</div>
		);
	}

	return (
		<div className='skin-preview' ref={wrapRef}>
			<div ref={bgRef} className='skin-preview__bg' />
			<div className='skin-preview__dim' style={{ opacity: Math.max(0, Math.min(1, dim)) }} />
			<canvas ref={canvasRef} className='skin-preview__canvas' />
			{skin.grade(grade, 'skin-preview__grade')}
		</div>
	);
}
