import 'dotenv/config';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import '@osu-idle/shared/osu/controlPointPatch';
import { BeatmapDecoder } from 'osu-parsers';
import { ManiaRuleset } from 'osu-mania-stable';
import * as rosu from 'rosu-pp-js';
import { isProd } from '../env';
import { db, pool } from './client';
import { beatmaps, type NewBeatmapRow } from './schema/beatmap';
import { beatmapset, type NewBeatmapsetRow } from './schema/beatmapset';

/**
 * Server-side beatmap ingestion - the authoritative-play analog of the client's
 * `scripts/index-beatmaps.mjs`. Reads the shared `.osz` corpus, parses every
 * mania difficulty, computes its star rating, and stores metadata + the raw
 * `.osu` chart in the `beatmap` table so the server can re-run the simulation.
 *
 * Idempotent: each fully-processed `.osz` is recorded in a local manifest, and
 * re-runs skip those files before unzipping/decoding so the whole corpus isn't
 * re-parsed and re-star-rated. The manifest is written after a file completes, so
 * an interrupt mid-file just re-processes that file next run. Pass `--force` to
 * ignore the manifest and re-ingest/upsert everything. Only positive (submitted)
 * beatmap ids are kept since plays reference maps by id.
 *
 *   npm run ingest-beatmaps [-- --force]
 */

const here = dirname(fileURLToPath(import.meta.url));
// packages/server/src/db -> packages/client/public/beatmaps
const corpus = join(here, '../../../client/public/beatmaps');
// Sidecar manifest of `.osz` filenames already ingested (git-ignored). Per-env:
// dev and prod target separate databases, so they track ingestion separately.
const manifestPath = join(here, isProd ? 'ingested-beatmaps.json' : 'ingested-beatmaps.dev.json');

const decoder = new BeatmapDecoder();
const mania = new ManiaRuleset();

const force = process.argv.includes('--force');

function loadManifest(): Set<string> {
	if (force) return new Set();
	try {
		return new Set<string>(JSON.parse(readFileSync(manifestPath, 'utf8')));
	} catch {
		return new Set();
	}
}

async function ingest(): Promise<void> {
	let files: string[] = [];
	try {
		files = readdirSync(corpus).filter(f => f.toLowerCase().endsWith('.osz'));
	} catch {
		console.error(`No beatmap corpus at ${corpus}`);
		return;
	}
	files.sort();

	const done = loadManifest();

	let ingested = 0;
	let skipped = 0;
	for (const file of files) {
		if (done.has(file)) { skipped++; continue; }

		const zip = new AdmZip(join(corpus, file));
		const entries = zip.getEntries().filter(e => e.entryName.toLowerCase().endsWith('.osu'));
		const setDone = false;

		for (const entry of entries) {
			const text = entry.getData().toString('utf8');
			let decoded;
			try {
				decoded = decoder.decodeFromString(text);
			} catch {
				continue;
			}
			// mania-only, and only maps we can reference by a real id
			if (decoded.originalMode !== 3) continue;
			const id = decoded.metadata.beatmapId;
			if (!id || id <= 0) continue;

			const ruleset = mania.applyToBeatmap(decoded);
			const lastTime = ruleset.hitObjects.reduce(
				(m, o) => Math.max(m, 'endTime' in o ? (o as { endTime: number }).endTime : o.startTime),
				0,
			);

			let sr = 0;
			try {
				const map = new rosu.Beatmap(entry.getData());
				sr = new rosu.Difficulty().calculate(map).stars;
				map.free();
			} catch { /* leave sr at 0 if rosu can't read it */ }

			const row: NewBeatmapRow = {
				id,
				setId: decoded.metadata.beatmapSetId,
				sr: String(Math.round(sr * 1000) / 1000),
				artist: decoded.metadata.artist,
				title: decoded.metadata.title,
				version: decoded.metadata.version,
				keys: ruleset.totalColumns,
				total_length: Math.round(lastTime / 1000),
				chart: text,
			};

			await db.insert(beatmaps).values(row).onDuplicateKeyUpdate({
				set: {
					setId: row.setId,
					sr: row.sr,
					artist: row.artist,
					title: row.title,
					version: row.version,
					keys: row.keys,
					total_length: row.total_length,
					chart: row.chart,
				},
			});

			if (!setDone) {
				const row: NewBeatmapsetRow = {
					id: decoded.metadata.beatmapSetId,
					artist: decoded.metadata.artist,
					title: decoded.metadata.title,
					creator: decoded.metadata.creator,
				};

				await db.insert(beatmapset).values(row).onDuplicateKeyUpdate({
					set: {
						artist: row.artist,
						title: row.title,
						creator: row.creator,
					},
				});
			}

			ingested++;
			console.log(`✓ ${id} ${row.artist} - ${row.title} [${row.version}] (${row.keys}K, ${row.sr}★)`);
		}

		// Mark the file done only after every difficulty in it landed, so an
		// interrupt mid-file re-processes it next run instead of silently skipping.
		done.add(file);
		writeFileSync(manifestPath, JSON.stringify([...done], null, '\t'));
	}

	console.log(
		`\nIngested ${ingested} difficult${ingested === 1 ? 'y' : 'ies'}` +
		`${skipped ? `, skipped ${skipped} file${skipped === 1 ? '' : 's'} already in manifest (use --force to re-ingest)` : ''}.`,
	);
}

ingest()
	.catch(e => { console.error(e); process.exitCode = 1; })
	.finally(() => pool.end());
