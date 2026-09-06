/**
 * Replay the scores a rollback left behind.
 *
 * Restoring a pre-release snapshot takes the players' progression back with it.
 * The scores themselves were dumped first, so this walks them in the order they
 * were set and rebuilds what followed from each one.
 *
 * A score row records its outcome but not the xp it paid, and xp cannot be
 * derived from the outcome - `getSkillsXP` reads the per-note blame that only a
 * simulation produces. So each score is simulated on its own map, at the levels
 * the character held by then, purely to get that blame: **the simulated outcome
 * is thrown away**. The stored row is what gets inserted, and what the xp
 * factors read for grade and misses.
 *
 * Sequential on purpose. Every play moves the levels the next one earns at, and
 * mindblock reads the plays already inserted, so the order is the point.
 *
 *   npm -w @osu-idle/server run replay:scores -- --file backups/scores.json --dry-run
 */
import { readFileSync } from 'node:fs';
import { i18n } from '@lingui/core';
import { BeatmapDecoder } from 'osu-parsers';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import CharacterBot from '@osu-idle/shared/sim/bots/character';
import { hasUnlock } from '@osu-idle/shared/rebirth';
import type { SkillName } from '@osu-idle/shared/skills';
import { Skills } from '@osu-idle/shared/skills';
import { eq } from 'drizzle-orm';
import { db } from './client';
import { characters } from './schema/character';
import {
	scores,
	type NewScoreRow,
} from './schema/score';
import { getBeatmap } from '../beatmaps';
import {
	getServerXP,
	loadCharacterSkills,
} from '../play';
import {
	applySkillXp,
	onSubmitScore,
} from '../scores';
import { getCharacterTotals } from './schema/character_totals';
import { addBeatmapPlayed } from './schema/beatmaps_played';

const decoder = new BeatmapDecoder();

const arg = (name: string): string | undefined => {
	const i = process.argv.indexOf(`--${name}`);
	return i === -1 ? undefined : process.argv[i + 1];
};
const dryRun = process.argv.includes('--dry-run');
const file = arg('file') ?? 'backups/scores-after-snapshot-153110.json';

/** A dumped row: mysql --batch gives every column back as a string. */
type DumpedScore = Record<string, string | null>;

/** The stored outcome, in the shape the xp factors read it. */
const asScoreLike = (row: DumpedScore) => ({
	score: Number(row.score),
	accuracy: Number(row.accuracy),
	grade: row.grade as never,
	MISS: Number(row.miss ?? 0),
	pfc: row.pfc === '1',
});

const toDraft = (row: DumpedScore): NewScoreRow => ({
	id: Number(row.id),
	characterId: Number(row.character_id),
	beatmapId: Number(row.beatmap_id),
	score: Number(row.score),
	accuracy: row.accuracy!,
	maxCombo: Number(row.max_combo),
	MARVELOUS: Number(row.marvelous), PERFECT: Number(row.perfect),
	GREAT: Number(row.great), GOOD: Number(row.good),
	BAD: Number(row.bad), MISS: Number(row.miss),
	DIVINE: Number(row.divine ?? 0),
	grade: row.grade as never,
	pp: row.pp!,
	ur: row.ur!,
	pfc: row.pfc === '1',
	playedAt: new Date(row.played_at!),
} as NewScoreRow);

/** Simulate the map at the character's current level, only to get the blame the
 *  xp split is built from. The play's own score never leaves this function. */
const xpFor = async (row: DumpedScore) => {
	const characterId = Number(row.character_id);
	const beatmapId = Number(row.beatmap_id);

	const [character] = await db.select().from(characters)
		.where(eq(characters.id, characterId)).limit(1);
	if (!character) return undefined;

	const beatmap = await getBeatmap(beatmapId);
	if (!beatmap?.chart) return undefined;

	const skills = await loadCharacterSkills(character, beatmapId);
	const chart = decoder.decodeFromString(beatmap.chart);
	const bot = new CharacterBot(skills, chart.difficulty.overallDifficulty);
	const game = new ManiaGame(chart, bot, { divine: hasUnlock(character.generation, 'DIVINE') });
	game.update(game.songEndMs + 1000); // straight to the end: only the blame matters

	// no session strain survived the rollback, so the play is credited unfatigued
	const session = {
		characterId, lastEnd: -Infinity, currentStrainTime: 0, currentMapTime: 0,
	};
	return getServerXP(character, session, bot, beatmap, chart, asScoreLike(row) as never);
};

const main = async () => {
	// nothing here serves a request, so there is no request-scoped i18n to
	// borrow: any translated string would otherwise throw
	i18n.loadAndActivate({
		locale: 'en', messages: {},
	});

	const rows = JSON.parse(readFileSync(file, 'utf8')) as DumpedScore[];
	console.log(`replaying ${rows.length} scores from ${file}${dryRun ? ' (dry run)' : ''}`);

	const totals = new Map<number, Record<SkillName, number>>();
	let done = 0, skipped = 0;

	for (const row of rows) {
		const xp = await xpFor(row);
		if (!xp) {
			skipped++;
			console.warn(`  skipped score ${row.id}: no character or no chart`);
			continue;
		}

		const characterId = Number(row.character_id);
		const seen = totals.get(characterId)
			?? Object.fromEntries(Skills.map(s => [s, 0])) as Record<SkillName, number>;
		for (const s of Skills) seen[s] += xp[s];
		totals.set(characterId, seen);

		if (!dryRun) {
			// milestones were announced the first time round: silent here
			await applySkillXp(characterId, xp, false);
			// the original row, not the simulated one
			await addBeatmapPlayed(characterId, Number(row.beatmap_id));
			await db.insert(scores).values(toDraft(row));
			const stored = (await db.select().from(scores)
				.where(eq(scores.id, Number(row.id))).limit(1))[0];
			if (stored) await onSubmitScore(await getCharacterTotals(characterId), stored);
		}

		if (++done % 100 === 0) console.log(`  ${done}/${rows.length}`);
	}

	console.log(`\ndone: ${done} replayed, ${skipped} skipped`);
	for (const [characterId, xp] of totals) {
		const sum = Skills.reduce((n, s) => n + xp[s], 0);
		console.log(`  character ${characterId}: ${sum.toLocaleString()} xp`);
	}
	process.exit(0);
};

void main();
