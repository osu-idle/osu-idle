import type Character from '../db/schema/character';
import { ManiaGame, type HitRecord } from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, { type NoteStrain } from '@osu-idle/shared/sim/bots/character';
import type RuntimeNote from '@osu-idle/shared/sim/runtimeNote';
import { judge, maniaWindows, ScoreState, type HitWindows } from './judgement';
import { JUDGEMENT } from '@osu-idle/shared/judgement';
import { Beatmap } from 'osu-classes';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';


/** Skill level the debug bot runs at - shared by the strain analysis and the
 *  debug play launched from the strain view, so they match. */
export const DEBUG_BOT_LEVEL = 14;

export interface StrainSeries {
	name: string
	hits: HitRecord[]
	score: ScoreState
	/** skill level, if this series corresponds to a single skill */
	level?: number
	/** total time spent running this skill's `analyze` across the map, in ms */
	computeMs?: number
	/** song time (ms) at which this series' HP first hit 0, if it failed */
	failMs?: number
	/** an extra 0..1 curve drawn over the graph (consistency: the pressure its
	 *  choke roll saw on each note) */
	overlay?: { time: number, value: number }[]
	/** XP this skill would gain from the combined play (combined: the total) */
	xp?: number
}

/** Song time at which a play failed (HP hit 0), or undefined if it survived. */
function failMsFromScore(score: ScoreState, hits: HitRecord[]): number | undefined {
	return score.failedIndex > 0 ? hits[score.failedIndex - 1]?.time : undefined;
}

/** Tally a ScoreState (score / accuracy / judgement counts) from hit records. */
function scoreFromHits(od: number, hits: HitRecord[]): ScoreState {
	const score = new ScoreState(od, hits.length);
	for (const h of hits) score.add(h.judgement);
	return score;
}

export interface StrainAnalysis {
	/** one series per skill, plus a final "combined" series (what the bot plays) */
	series: StrainSeries[]
	windows: HitWindows
	songEndMs: number
}

export function analyzeBeatmap(
	character: Character,
	beatmap: Beatmap,
	scrollMs = 600,
): StrainAnalysis {
	const skills = makeOrderedSkills(DEBUG_BOT_LEVEL) ?? character.skills;
	const bot = new CharacterBot(skills, beatmap.difficulty.overallDifficulty);
	const game = new ManiaGame(beatmap, bot, { scrollMs });

	const series = new Map<string, StrainSeries>();
	for (const skill of Object.values(skills)) {
		series.set(skill.name, { name: skill.name, hits: [], score: scoreFromHits(beatmap.difficulty.overallDifficulty, []) });
	}

	const windows = maniaWindows(beatmap.difficulty.overallDifficulty);
	// `noteStrains` is private; its type is elided in the shared package's .d.ts,
	// so re-assert the shape for this debug view.
	const noteStrains = bot['noteStrains'] as Map<string, [RuntimeNote, [NoteStrain, number, number][]]>;
	for (const [, [note, strains]] of noteStrains) {
		for (const skill of Object.values(skills)) {
			const strain = strains.find(s => s[0].skill === skill.name);
			if (!strain) continue;

			if (skill.name === 'consistency' && strain[0].pressure !== undefined) {
				const s = series.get(skill.name)!;
				(s.overlay ??= []).push({ time: note.time, value: strain[0].pressure });
			}

			if (skill.name !== 'release') {
				const j = judge(Math.abs(strain[1]), windows);
				// match the combined graph: a miss has no meaningful offset
				series.get(skill.name)?.hits.push({ time: note.time, offset: j === JUDGEMENT.MISS ? null : strain[1], judgement: j });
			}
			if (skill.name === 'release' && note.hold) {
				const j = judge(Math.abs(strain[2]), windows);
				series.get(skill.name)?.hits.push({ time: note.endTime, offset: j === JUDGEMENT.MISS ? null : strain[2], judgement: j });
			}
		}
	}

	for (const skill of Object.values(skills)) {
		const s = series.get(skill.name)!;
		s.score = scoreFromHits(beatmap.difficulty.overallDifficulty, s.hits);
		s.level = skill.level.get();
		s.failMs = failMsFromScore(s.score, s.hits);
	}

	game.update(game.songEndMs + 2000);

	const combinedScore = scoreFromHits(beatmap.difficulty.overallDifficulty, game.hits);

	// XP breakdown: what each skill would earn from this play's combined score
	const xp = bot.getSkillsXP(beatmap.totalLength, combinedScore);
	for (const skill of Object.values(skills)) {
		series.get(skill.name)!.xp = xp[skill.name];
	}

	series.set('combined', {
		name: 'combined',
		hits: game.hits,
		score: combinedScore,
		failMs: failMsFromScore(combinedScore, game.hits),
		xp: Object.values(xp).reduce((sum, gain) => sum + gain, 0),
	});

	return { series: Array.from(series.values()), windows, songEndMs: game.songEndMs };
}
