import { execFileSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { extname } from 'node:path';
import AdmZip from 'adm-zip';
import '@osu-idle/shared/osu/controlPointPatch';
import { BeatmapDecoder } from 'osu-parsers';
import { ManiaRuleset } from 'osu-mania-stable';
import * as rosu from 'rosu-pp-js';
import { INTRO_SET_ID } from '@osu-idle/shared/beatmap';
import { db } from '../db/client';
import {
	beatmaps,
	type NewBeatmapRow,
} from '../db/schema/beatmap';
import { beatmapset } from '../db/schema/beatmapset';
import {
	BEATMAP_DIR,
	PREVIEW_DIR,
	oszPath,
	previewPath,
} from './storage';

/**
 * The single runtime beatmap pipeline - replaces the old client `index-beatmaps`
 * (manifest + previews) and server `ingest-beatmaps` (DB) scripts. Given a raw
 * `.osz`, it parses every mania difficulty, computes star rating + the rich
 * catalog metadata, generates the preview audio/background, stores the `.osz` and
 * previews under their set-id names, and upserts the `beatmapset` + `beatmap`
 * rows. It never touches `status`/`rankedAt`/`announced` on an existing set, so
 * re-ingesting (a re-upload) leaves its nomination state intact - new sets land
 * as `pending`.
 */

const decoder = new BeatmapDecoder();
const mania = new ManiaRuleset();

export type IngestResult = {
	setId: number;
	difficulties: number;
};

export const ingestOsz = async (buffer: Buffer): Promise<IngestResult> => {
	const zip = new AdmZip(buffer);
	const entries = zip.getEntries();
	const findEntry = (name: string) =>
		entries.find(e => e.entryName.toLowerCase() === name.toLowerCase());

	const parsed = entries
		.filter(e => e.entryName.toLowerCase().endsWith('.osu'))
		.map(e => e.getData())
		.flatMap(buf => {
			let decoded;
			try { decoded = decoder.decodeFromString(buf.toString('utf8')); } catch { return []; }
			// mania-only, except the standard-mode intro set, and only maps we can
			// reference by a real id.
			const isIntro = decoded.metadata.beatmapSetId === INTRO_SET_ID;
			if (decoded.originalMode !== 3 && !isIntro) return [];
			const id = decoded.metadata.beatmapId;
			if (!id || id <= 0) return [];
			return [{
				buf, decoded, 
			}];
		});

	if (parsed.length === 0) throw new Error('No mania difficulties with a valid beatmap id');

	const setId = parsed[0].decoded.metadata.beatmapSetId;
	if (!setId || setId <= 0) throw new Error('Beatmap set has no valid set id');

	mkdirSync(BEATMAP_DIR, { recursive: true });
	mkdirSync(PREVIEW_DIR, { recursive: true });

	// 1. Store the .osz keyed by set id.
	writeFileSync(oszPath(setId), buffer);

	// 2. Extract each distinct background / audio source once, named by set id.
	//    Difficulties sharing a source get the same preview filename.
	const bgAssets = new Map<string, string | undefined>();
	const audioAssets = new Map<string, string | undefined>();

	const resolveBackground = (bg: string | undefined): string | undefined => {
		if (!bg) return undefined;
		const key = bg.toLowerCase();
		if (bgAssets.has(key)) return bgAssets.get(key);
		const entry = findEntry(bg);
		if (!entry) { bgAssets.set(key, undefined); return undefined; }
		const ext = extname(bg) || '.jpg';
		const idx = bgAssets.size;
		const out = idx === 0 ? `${setId}${ext}` : `${setId}-bg${idx}${ext}`;
		writeFileSync(previewPath(out), entry.getData());
		bgAssets.set(key, out);
		return out;
	};

	const resolveAudio = (audio: string | undefined, previewTimeMs: number): string | undefined => {
		if (!audio) return undefined;
		const key = audio.toLowerCase();
		if (audioAssets.has(key)) return audioAssets.get(key);
		const entry = findEntry(audio);
		if (!entry) { audioAssets.set(key, undefined); return undefined; }
		const idx = audioAssets.size;
		const out = idx === 0 ? `${setId}.mp3` : `${setId}-audio${idx}.mp3`;
		const temp = previewPath(`${setId}_temp${idx}${extname(audio)}`);
		writeFileSync(temp, entry.getData());
		const start = previewTimeMs > 0 ? (previewTimeMs / 1000).toFixed(2) : '40.00';
		let result: string | undefined;
		try {
			execFileSync('ffmpeg', [
				'-y', '-ss', start, '-i', temp, '-t', '10',
				'-c:a', 'libmp3lame', '-q:a', '4', previewPath(out),
			], { stdio: 'ignore' });
			result = out;
		} catch (err) {
			console.error(`  ffmpeg failed to create preview for ${setId}:`, err);
		} finally {
			if (existsSync(temp)) rmSync(temp);
		}
		audioAssets.set(key, result);
		return result;
	};

	// 3. Build + upsert the difficulty rows.
	const rows: NewBeatmapRow[] = [];
	for (const { buf, decoded } of parsed) {
		// Column count needs the mania ruleset; the intro is standard mode, so
		// guard it and leave keys at 0 there (the intro never needs a key count).
		let keys = 0;
		try { keys = mania.applyToBeatmap(decoded).totalColumns; } catch { /* non-mania intro */ }

		let sr = 0, bpm = 0, objects = 0, rice = 0, ln = 0;
		try {
			const map = new rosu.Beatmap(buf);
			sr = new rosu.Difficulty().calculate(map).stars;
			bpm = map.bpm;
			objects = map.nObjects;
			rice = map.nCircles;
			ln = map.nSliders;
			map.free();
		} catch { /* leave defaults if rosu can't read it */ }

		rows.push({
			id: decoded.metadata.beatmapId,
			setId,
			sr: String(Math.round(sr * 1000) / 1000),
			artist: decoded.metadata.artist,
			title: decoded.metadata.title,
			version: decoded.metadata.version,
			keys,
			total_length: Math.round(decoded.totalLength),
			chart: buf.toString('utf8'),
			bpm: Math.round(bpm),
			objects,
			rice,
			ln,
			mode: decoded.originalMode,
			audio: resolveAudio(decoded.general.audioFilename, decoded.general.previewTime),
			background: resolveBackground(decoded.events.backgroundPath ?? undefined),
		});
	}

	const meta = parsed[0].decoded.metadata;
	// The intro must be live to be served, but it's never "nominated" - rank it
	// on first ingest (announced so the sweep skips it). Everything else lands as
	// pending. Re-ingest preserves status/rankedAt/announced either way.
	const intro = setId === INTRO_SET_ID
		? {
			status: 'ranked' as const, rankedAt: new Date(), announced: true, 
		}
		: {};
	await db.insert(beatmapset).values({
		id: setId,
		artist: meta.artist,
		title: meta.title,
		creator: meta.creator,
		...intro,
	}).onDuplicateKeyUpdate({
		set: {
			artist: meta.artist, title: meta.title, creator: meta.creator, 
		}, 
	});

	for (const row of rows) {
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
				bpm: row.bpm,
				objects: row.objects,
				rice: row.rice,
				ln: row.ln,
				mode: row.mode,
				audio: row.audio,
				background: row.background,
			},
		});
	}

	return {
		setId, difficulties: rows.length, 
	};
};
