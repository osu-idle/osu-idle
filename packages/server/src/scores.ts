import { eq } from 'drizzle-orm';
import { type SkillName } from '@osu-idle/shared/skills';
import { db } from './db/client';
import {
	characters,
	getCharacterById,
} from './db/schema/character';
import { getBeatmapById } from './db/schema/beatmap';
import { announce } from './ws/chat';
import { DEFAULT_CHANNEL } from '@osu-idle/shared/community/wire';
import {
	billionsMessage,
	firstPlaceMessage,
} from '@osu-idle/shared/community/announcements';
import {
	getScoreById,
	scores,
	type NewScoreRow,
	type ScoreRow,
} from './db/schema/score';
import {
	getBestPlay,
	setNewBestPlay,
} from './db/schema/best';
import {
	addBestScoreToTotals,
	addScoreToTotals,
	getCharacterTotals,
	removeBestScoreFromTotals,
	updateCharacterTotals,
	type CharacterTotalsRow,
} from './db/schema/character_totals';
import {
	bestPP,
	getBestPPPlay,
	setNewBestPPPlay,
} from './db/schema/best_pp';
import { addBeatmapPlayed } from './db/schema/beatmaps_played';
import {
	getFirstPlace,
	setNewFirstPlace,
} from './db/schema/first_place';
import Overall from '@osu-idle/shared/sim/skills/overall';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';

/** Recompute only the character's pp: the weighted (0.95^i) sum of its per-map
 *  best pp, read straight from the `best_pp` table (one row per beatmap). Leaves
 *  total/ranked score untouched. */
export async function recomputePP(characterId: number): Promise<void> {
	const rows = await db
		.select({ pp: bestPP.pp })
		.from(bestPP)
		.where(eq(bestPP.characterId, characterId));

	const pp = rows
		.map(r => Number(r.pp))
		.sort((a, b) => b - a)
		.reduce((sum, p, i) => sum + p * Math.pow(0.95, i), 0);

	await db
		.update(characters)
		.set({ pp: String(Math.round(pp * 1000) / 1000) })
		.where(eq(characters.id, characterId));
}

/** Insert a score and refresh the character's profile aggregates. The single
 *  entry point for a new ranked play. */
export async function submitScore(draft: NewScoreRow) {
	await addBeatmapPlayed(draft.characterId, draft.beatmapId);
	const totals = await getCharacterTotals(draft.characterId);
	const [ins] = await db.insert(scores).values(draft);
	const score = (await getScoreById(ins.insertId))!;
	await onSubmitScore(totals, score);
	return score;
}

export const onSubmitScore = async (
	totals: CharacterTotalsRow, 
	score: ScoreRow, 
	recompute = true,
) => {
	await addScoreToTotals(totals, score);
	await checkNewBest(totals, score);
	await checkNewBestPP(score, recompute);
	await checkNewFirstPlace(score);

	await updateCharacterTotals(totals);
};

export const compareScores = (s1: ScoreRow, s2: ScoreRow) => {
	const d1 = s1.score - s2.score;
	if (d1 !== 0) return d1 > 0;
	return (s1.id - s2.id) < 0;
};

export const compareScoresPP = (s1: ScoreRow, s2: ScoreRow) => {
	const d1 = parseFloat(s1.pp) - parseFloat(s2.pp);
	if (isNaN(d1)) return false;
	if (d1 !== 0) return d1 > 0;
	return (s1.id - s2.id) < 0;
};

export const checkNewBest = async (totals: CharacterTotalsRow, score: ScoreRow) => {
	const best = await getBestPlay(score.characterId, score.beatmapId);
	if (best) {
		if (compareScores(best, score)) return;
		removeBestScoreFromTotals(totals, best);
	}

	const billionsBefore = Math.floor(totals.rankedScore / 1_000_000_000);
	addBestScoreToTotals(totals, score);
	await setNewBestPlay(score);

	const billionsAfter = Math.floor(totals.rankedScore / 1_000_000_000);

	if (billionsAfter > billionsBefore) {
		await announceBillions(score, totals.rankedScore);
	}
};

export const checkNewBestPP = async (score: ScoreRow, recompute = true) => {
	const best = await getBestPPPlay(score.characterId, score.beatmapId);
	if (best && compareScoresPP(best, score)) return;

	await setNewBestPPPlay(score);
	if (recompute) await recomputePP(score.characterId);
};

export const checkNewFirstPlace = async (score: ScoreRow) => {
	const best = await getFirstPlace(score.beatmapId);
	if (best && compareScores(best, score)) return;

	await setNewFirstPlace(score);
	await announceFirstPlace(score);
};

/** Server-announce a new #1 in chat (a "perfect" variant for a max score). */
const announceFirstPlace = async (score: ScoreRow) => {
	const [character, beatmap] = await Promise.all([
		getCharacterById(score.characterId),
		getBeatmapById(score.beatmapId),
	]);
	if (!character || !beatmap) return;

	const perfect = score.score >= 1_000_000;
	announce(
		DEFAULT_CHANNEL, 
		firstPlaceMessage(character.name, beatmap, perfect), 
		perfect ? '#c794ff' : '#fa81c6',
	);
};

/** Server-announce a new #1 in chat (a "perfect" variant for a max score). */
const announceBillions = async (score: ScoreRow, rankedScore: number) => {
	const character = await getCharacterById(score.characterId);
	if (!character) return;

	const billions = Math.floor(rankedScore / 1_000_000_000) * 1_000_000_000;
	announce(
		DEFAULT_CHANNEL, 
		billionsMessage(character.name, billions), 
		'#81e2fa',
	);
};

/** Apply per-skill XP gains to a character, reusing the shared levelling curve.
 *  Returns the per-skill before/after progression for the result screen. */
export async function applySkillXp(
	characterId: number,
	xp: Record<SkillName, number>,
) {
	const [row] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
	if (!row) throw new Error(`character ${characterId} not found`);

	const skills = makeOrderedSkills();
	const overall = new Overall();
	overall.level.set(row.overallLevel);
	overall.xp.set(row.overallXp);
	let overallXpGained = 0;
	const gains = skills.map(skill => {
		const fromLevel = row[`${skill.name}Level`];
		const fromXp = row[`${skill.name}Xp`];
		skill.level.set(fromLevel);
		skill.xp.set(fromXp);
		overallXpGained += xp[skill.name];
		const levels = skill.gainXP(xp[skill.name] ?? 0);
		return {
			skill: skill.name, 
			gained: xp[skill.name] ?? 0, 
			fromLevel, 
			fromXp,
			toLevel: skill.level.get(),
			toXp: Math.round(skill.xp.get()),
			levels, 
			xp: xp[skill.name], 
		};
	});

	overall.gainXP(overallXpGained);

	const updates = Object.fromEntries(
		[
			...gains.flatMap(g => [
				[`${g.skill}Level`, g.toLevel],
				[`${g.skill}Xp`, g.toXp],
				[`${g.skill}TotalXp`, row[`${g.skill}TotalXp`] + g.xp],
			]),
			['overallLevel', overall.level.get()],
			['overallXp', overall.xp.get()],
			['overallTotalXp', row.overallTotalXp + overallXpGained],
		],
	) as Record<`${
		'overall'
		| SkillName}Level` 
		| `${'overall' 
		| SkillName}Xp` 
		| `${'overall' 
		| SkillName}TotalXp`,
	number
	>;

	await db.update(characters).set(updates).where(eq(characters.id, characterId));
	return gains;
}
