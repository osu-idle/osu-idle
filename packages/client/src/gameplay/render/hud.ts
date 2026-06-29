import Reading from '@osu-idle/shared/sim/skills/reading';
import Speed from '@osu-idle/shared/sim/skills/speed';
import num from '@osu-idle/shared/display/num';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import { type Grade } from '@osu-idle/shared/judgement';
import { MAX_HP } from '@osu-idle/shared/sim/scoring';
import { drawHpBar } from '../hpBar';
import { drawHitErrorBar } from '../hitError';
import {
	roundRect,
	STRAIN_HUD_SKILLS,
	type Frame,
	type Layer,
	type StrainHud,
} from './frame';

// strain meters (left side): one stress gauge per skill, 0-100%. Narrow screens
// drop the bars and show just the %, tinted the gauge's colour. `display` carries
// the eased value between frames so per-note jumps read as motion.
const drawStrainMeters = (
	f: Frame,
	strain: StrainHud,
	display: Record<SkillName, number>,
) => {
	const { ctx, now, vp } = f;
	const compact = vp.w < 700;
	const strains = strain.bot.strainsAt(now);
	const bx = 16;
	const bw = 150;
	const step = compact ? 30 : 26;
	const by0 = Math.max(150, vp.h * 0.24);
	ctx.font = '600 11px "Exo 2", sans-serif';
	STRAIN_HUD_SKILLS.forEach((skill, i) => {
		const added = (strains[skill] - display[skill]) * 0.2;
		const v = display[skill] += added;
		const by = by0 + i * step;
		// calm green → stressed red
		const color = `hsl(${120 - v * 120}, 85%, 55%)`;
		ctx.textAlign = 'left';
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.fillText(strain.labels[skill], bx, by);
		if (compact) {
			ctx.fillStyle = color;
			ctx.fillText(`${Math.round(v * 100)}%`, bx, by + 13);
			return;
		}
		ctx.textAlign = 'right';
		ctx.fillText(`${Math.round(v * 100)}%`, bx + bw, by);
		ctx.fillStyle = 'rgba(255,255,255,0.12)';
		roundRect(ctx, bx, by + 5, bw, 8, 4);
		ctx.fill();
		if (v > 0.005) {
			ctx.fillStyle = color;
			roundRect(ctx, bx, by + 5, Math.max(8, bw * v), 8, 4);
			ctx.fill();
		}
	});
};

// debug-only telemetry over the playfield (nps, visible notes, transitions, ...)
const drawDebugStats = (f: Frame, cxField: number) => {
	const { ctx, game, now, vp } = f;
	ctx.fillStyle = '#fff';
	ctx.font = '800 23px "Exo 2", sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText(`${game.npsAt(now)}nps`, cxField, vp.h * 0.32);
	ctx.fillText(`${game.visibleNotesAt(now).length}v`, cxField, vp.h * 0.28);
	ctx.fillText(`${Reading.countTransitions(
		new Map(),
		game.visibleNotesAt(now))}t`,
	cxField,
	vp.h * 0.36,
	);
	ctx.fillText(
		`${num(Speed.weightedGroups(
			new Map(),
			game.recentNotes(now),
		), 2)}g`,
		cxField,
		vp.h * 0.39,
	);
	ctx.textAlign = 'left';
	ctx.fillText(
		`x${Math.round(game.scroll.getSpeedAt(now) * 100) / 100}`,
		15,
		vp.h * 0.1,
	);
};

/**
 * The HUD layer: judgement popup, combo, strain gauges, accuracy/score, progress
 * bar, HP bar and hit-error bar. A factory because the HP and strain gauges carry
 * eased state between frames; the grade badge is a DOM element in the caller, fed
 * via `opts.onGrade` only when the grade changes.
 */
export const makeHud = (): Layer => {
	const strainDisplay =
		Object.fromEntries(Skills.map(s => [s, 0])) as Record<SkillName, number>;
	let hpEased = 1;
	let hpLast = performance.now();
	let lastGrade: Grade | undefined;

	return (f) => {
		const { ctx, game, skin, now, vp, g, opts } = f;
		const cxField = g.x0 + g.fieldWidth / 2;

		// judgement popup
		const flash = game.lastFlash;
		if (flash) {
			const age = now - flash.time;
			if (age >= 0 && age < 400) {
				ctx.globalAlpha = 1 - age / 400;
				ctx.fillStyle = skin.data.judgements[flash.judgement].judge;
				ctx.font = '700 26px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(skin.data.judgements[flash.judgement].text, cxField, g.lineY - 90);
				ctx.globalAlpha = 1;
			}
		}
		// combo
		if (game.score.combo > 1) {
			ctx.fillStyle = '#fff';
			ctx.font = '800 44px "Exo 2", sans-serif';
			ctx.textAlign = 'center';
			ctx.fillText(`${game.score.combo}x`, cxField, vp.h * 0.42);
		}

		if (opts.debug) drawDebugStats(f, cxField);
		if (opts.strain) drawStrainMeters(f, opts.strain, strainDisplay);

		// current grade badge (a DOM <img> in the caller, fed on change only)
		if (game.score.grade !== lastGrade) {
			lastGrade = game.score.grade;
			opts.onGrade?.(game.score.grade);
		}

		// accuracy + score (top right)
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'right';
		ctx.font = '700 30px "Exo 2", sans-serif';
		ctx.fillText(
			`${(game.score.accuracy * 100).toFixed(2)}%`,
			vp.w - 28,
			opts.mobile ? 90 : 48,
		);
		ctx.font = '500 18px "Exo 2", sans-serif';
		ctx.fillStyle = 'rgba(255,255,255,0.75)';
		ctx.fillText(
			Math.round(game.score.score).toLocaleString(),
			vp.w - 28,
			opts.mobile ? 120 : 76,
		);

		// progress bar
		const prog = Math.max(0, Math.min(1, now / game.songEndMs));
		ctx.fillStyle = 'rgba(255,255,255,0.12)';
		ctx.fillRect(0, 0, vp.w, 4);
		ctx.fillStyle = '#ff66ab';
		ctx.fillRect(0, 0, vp.w * prog, 4);

		// HP bar (right of the playfield) - eased toward the live value, drawn before
		// the hit-error bar so that bar stays on top of it
		const tNow = performance.now();
		const transition = (1 - Math.exp(-(tNow - hpLast) / skin.data.hpBar.transitionMs));
		hpEased += (game.score.hp / MAX_HP - hpEased) * transition;
		hpLast = tNow;
		drawHpBar(skin, ctx, {
			hp: hpEased,
			x: g.x0 + g.fieldWidth + skin.data.hpBar.gap,
			bottom: vp.h - skin.data.hpBar.fromBottom,
		});

		// hit-error bar (below the receptors)
		drawHitErrorBar(skin, ctx, {
			windows: game.windows,
			hits: game.hits,
			now,
			cx: cxField,
			y: g.lineY + 78,
			halfWidth: Math.min(170, g.fieldWidth / 2),
		});
	};
};
