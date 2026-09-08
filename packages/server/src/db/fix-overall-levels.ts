/**
 * Put the running totals back in step with the levels they are supposed to add
 * up to.
 *
 * Prestige used to reset a skill without charging the overall level for it, so
 * a character who prestiged kept the overall level all those levels had bought
 * while the skills themselves went back to zero - prestige everything and still
 * read Lv104. Prestige now spends what it resets; this fixes the rows written
 * before it did.
 *
 * The correction needs no history. A skill's total is what its level and the xp
 * inside it are worth - gains raise both, upgrades and prestige take from both -
 * so recomputing from the level is exact, and a no-op for anyone the old bug
 * never touched.
 *
 * Lifetime is deliberately left alone: it is the one figure nothing spends.
 *
 *   npm -w @osu-idle/server run fix:overall:prod -- --dry-run
 */
import { eq } from 'drizzle-orm';
import {
	xpGivesLevel,
	xpToLevel,
} from '@osu-idle/shared/sim/skills/xp';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import { db } from './client';
import { characters } from './schema/character';
import { reindexCharacter } from '../rankings';

const dryRun = process.argv.includes('--dry-run');
/** Rounding noise, not a wrong total: levels are stored as integers. */
const TOLERANCE = 1000;

const main = async () => {
	const rows = await db.select().from(characters);
	console.log(`checking ${rows.length} characters${dryRun ? ' (dry run)' : ''}`);

	let fixed = 0;
	for (const row of rows) {
		const totals = {} as Record<SkillName, number>;
		let overallTotalXp = 0;
		for (const skill of Skills) {
			const owed = Math.round(xpToLevel(row[`${skill}Level`]) + row[`${skill}Xp`]);
			totals[skill] = owed;
			overallTotalXp += owed;
		}

		const drift = row.overallTotalXp - overallTotalXp;
		if (Math.abs(drift) < TOLERANCE) continue;

		const overall = xpGivesLevel(overallTotalXp);
		console.log(
			`  ${row.name} (${row.id}): Lv${row.overallLevel} -> Lv${overall.level}`
			+ `  (${row.overallTotalXp.toLocaleString()} -> ${overallTotalXp.toLocaleString()} xp)`,
		);

		if (!dryRun) {
			await db.update(characters).set({
				...Object.fromEntries(Skills.map(s => [`${s}TotalXp`, totals[s]])),
				overallTotalXp,
				overallLevel: overall.level,
				overallXp: Math.round(overall.xp),
			}).where(eq(characters.id, row.id));
			// the boards rank on these, so they have to be told
			await reindexCharacter(row.id);
		}
		fixed++;
	}

	console.log(`\n${fixed} character${fixed === 1 ? '' : 's'} ${dryRun ? 'would be' : ''} corrected`);
	process.exit(0);
};

void main();
