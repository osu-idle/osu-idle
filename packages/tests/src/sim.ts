
import '@osu-idle/shared/osu/controlPointPatch'; // O(1) groupAt - SV-heavy maps decode in ms, not seconds
import type { Beatmap } from 'osu-classes';
import { ManiaGame, type HitRecord } from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, { type NoteStrain } from '@osu-idle/shared/sim/bots/character';
import type RuntimeNote from '@osu-idle/shared/sim/runtimeNote';
import { ScoreState, judge, maniaWindows } from '@osu-idle/shared/sim/scoring';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import { Skills, type SkillName } from '@osu-idle/shared/skills';

/**
 * Load a hand-picked `.osu` chart and run the authoritative simulation against a
 * skill set. Two modes:
 *  - {@link simulate} - the full bot plays the map (every skill contributes), the
 *    same path the server's `startPlay` takes. This is a real, scored play.
 *  - {@link analyzeSkill} - score one skill *in isolation*: judge every note using
 *    only that skill's own strain offset. This mirrors the in-app strain-debug
 *    page, and (because each skill reads only its own strain) depends solely on
 *    that skill's level.
 *
 * The bot plays with random timing error, so a single run is a sample; callers
 * (see `harness.ts`) average many runs.
 *
 * NOTE: the bot's strain analysis assumes 4 columns, so charts must be 4K mania.
 */

/** A skill set: a single uniform level for all skills, or explicit per-skill
 *  levels (any skill left out defaults to 0). */
export type SkillSpec = number | Partial<Record<SkillName, number>>;

/** Every skill at the same `level`. */
export function uniform(level: number): Record<SkillName, number> {
	return Object.fromEntries(Skills.map(n => [n, level])) as Record<SkillName, number>;
}

function resolve(spec: SkillSpec): Record<SkillName, number> {
	return typeof spec === 'number'
		? uniform(spec)
		: Object.fromEntries(Skills.map(n => [n, spec[n] ?? 0])) as Record<SkillName, number>;
}

function build(spec: SkillSpec, od: number): CharacterBot {
	const levels = resolve(spec);
	const skills = makeOrderedSkills();
	for (const skill of skills) skill.level.set(levels[skill.name]);
	return new CharacterBot(skills, od);
}

/** A ScoreState rebuilt from a sequence of hit records (in resolution order). */
function scoreFromHits(od: number, hits: HitRecord[]): ScoreState {
	const score = new ScoreState(od, hits.length);
	for (const h of hits) score.add(h.judgement);
	return score;
}

/** Run one full play of `beatmap` by the whole bot at the given skill levels. */
export function simulate(beatmap: Beatmap, spec: SkillSpec): ManiaGame {
	const game = new ManiaGame(beatmap, build(spec, beatmap.difficulty.overallDifficulty));
	game.update(game.songEndMs + 1000); // advance past the end so every note resolves
	return game;
}

export interface SkillResult {
	/** the score this skill alone would produce on the map */
	score: ScoreState;
	/** per-note judgements from this skill's strain offset, in note order */
	hits: HitRecord[];
}

/**
 * Score a single skill in isolation on `beatmap` at `level` - every note judged
 * by only that skill's strain offset, exactly as the strain-debug view does.
 * Other skills are irrelevant (each reads only its own strain), so they stay 0.
 */
export function analyzeSkill(beatmap: Beatmap, skill: SkillName, level: number): SkillResult {
	const bot = build({ [skill]: level }, beatmap.difficulty.overallDifficulty);
	// Constructing the game runs the bot's analyzeContext, filling its per-note,
	// per-skill strain table. `noteStrains` is private; its type is elided in the
	// shared .d.ts, so re-assert the shape (same as strainDebug.ts does).
	new ManiaGame(beatmap, bot);
	const windows = maniaWindows(beatmap.difficulty.overallDifficulty);
	const noteStrains = bot['noteStrains'] as Map<string, [RuntimeNote, [NoteStrain, number, number][]]>;

	const hits: HitRecord[] = [];
	for (const [, [note, strains]] of noteStrains) {
		const entry = strains.find(s => s[0].skill === skill);
		if (!entry) continue;
		const [, pressOffset, releaseOffset] = entry;
		if (skill !== 'release') {
			hits.push({ time: note.time, offset: pressOffset, judgement: judge(Math.abs(pressOffset), windows) });
		} else if (note.hold) {
			// the release skill only judges long-note tails
			hits.push({ time: note.endTime, offset: releaseOffset, judgement: judge(Math.abs(releaseOffset), windows) });
		}
	}
	return { score: scoreFromHits(beatmap.difficulty.overallDifficulty, hits), hits };
}
