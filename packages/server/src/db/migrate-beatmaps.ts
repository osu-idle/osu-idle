import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTRO_SET_ID } from '@osu-idle/shared/beatmap';
import { pool } from './client';
import { ingestOsz } from '../beatmaps/ingest';

/**
 * One-off: ingest the standard-mode intro set (circles!) - the single map the
 * main corpus ingest skipped because it isn't mania. Everything else is already
 * in the DB; this just gets the intro in so the startup sequence works.
 *
 *   npm -w @osu-idle/server run migrate:beatmaps[:prod]
 */

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, '../../../client/public/beatmaps');

const main = async (): Promise<void> => {
	const file = readdirSync(corpus).find(f => f.startsWith(`${INTRO_SET_ID}`) && f.toLowerCase().endsWith('.osz'));
	if (!file) throw new Error(`Intro .osz (set ${INTRO_SET_ID}) not found in ${corpus}`);

	const { setId, difficulties } = await ingestOsz(readFileSync(join(corpus, file)));
	console.log(`✓ ingested intro ${setId} (${difficulties} diff) ${file}`);
};

main()
	.catch(e => { console.error(e); process.exitCode = 1; })
	.finally(() => pool.end());
