import { readdirSync, writeFileSync, existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import AdmZip from 'adm-zip';
import rosu from 'rosu-pp-js';
import { BeatmapDecoder } from 'osu-parsers';
import { argv } from 'process';
const { Beatmap, Difficulty } = rosu;

const decoder = new BeatmapDecoder();

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'public', 'beatmaps');
const previews = join(here, '..', 'public', 'previews');
const manifestFile = join(dir, 'manifest.json');

// Ensure destination directories exist
if (!existsSync(previews)) mkdirSync(previews, { recursive: true });

let files = [];
try {
	files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.osz'));
} catch {
	// directory may not exist yet
}
files.sort();

const previousManifest = JSON.parse(readFileSync(manifestFile));

const force = argv[2] === '--force';

const manifest = {
	intro: force ? undefined : previousManifest.intro,
	beatmaps: force ? [] : previousManifest.beatmaps
};

// --- Process each .osz file ---
files.forEach(file => {
	const name = basename(file, '.osz');
	let setId = name;
	const zipPath = join(dir, file);

	const key = name;

	if (!force && previousManifest && !!previousManifest.beatmaps.find(b => b.file === key)) {
		return;
	}
  
	console.log(`Processing metadata and previews for: ${setId}...`);

	try {
		const zip = new AdmZip(zipPath);
		const entries = zip.getEntries();
		const osuEntries = entries.filter(e => e.entryName.toLowerCase().endsWith('.osu'));

		if (osuEntries.length === 0) return;

		const metadata = {
			file: key,
			runtime: false,
			title: 'Unknown Title',
			artist: 'Unknown Artist',
			creator: '',
			versions: []
		};

		// 1. Parse every .osu - collect per-difficulty metadata + its own audio /
		//    background source (these can differ between difficulties: map packs
		//    have per-difficulty audio, and per-difficulty backgrounds are common).
		const parsed = osuEntries.map((osuEntry) => {
			const buffer = osuEntry.getData(); // Raw bytes
			const content = buffer.toString('utf8'); // Text for manual metadata parsing
			const lines = content.split(/\r?\n/);

			const info = {
				buffer,
				mapId: undefined,
				version: 'Beginner',
				mode: 0,            // [General] Mode: 0=osu 1=taiko 2=catch 3=mania
				keys: 0,            // [Difficulty] CircleSize = key/column count in mania
				audioFilename: null,
				previewTimeMs: -1,
				bgFilename: null,
			};

			lines.forEach(line => {
				const tLine = line.trim();

				if (tLine.startsWith('BeatmapSetID:')) setId = Number(tLine.split(':').pop());
				if (tLine.startsWith('BeatmapID:')) info.mapId = Number(tLine.split(':').pop());
				if (tLine.startsWith('Title:')) metadata.title = tLine.substring(6);
				if (tLine.startsWith('Artist:')) metadata.artist = tLine.substring(7);
				if (tLine.startsWith('Creator:')) metadata.creator = tLine.substring(8);
				if (tLine.startsWith('AudioFilename:')) info.audioFilename = tLine.substring(14).trim();
				if (tLine.startsWith('PreviewTime:')) info.previewTimeMs = parseInt(tLine.substring(12), 10);
				if (tLine.startsWith('Mode:')) info.mode = Number(tLine.split(':').pop());
				if (tLine.startsWith('CircleSize:')) info.keys = Math.round(Number(tLine.split(':').pop()));

				const bgMatch = tLine.match(/^0,0,"([^"]+)"/);
				if (bgMatch) info.bgFilename = bgMatch[1];

				if (tLine.startsWith('Version:')) info.version = tLine.substring(8);
			});

			return info;
		});

		// 2. Extract each distinct background / audio source once and remember the
		//    asset path, keyed by the lowercased source filename. Difficulties that
		//    share a source get the SAME asset path, so the app can tell whether two
		//    difficulties use the same song/background by comparing paths.
		const bgAssets = new Map();   // sourceLower -> "previews/<file>"
		const audioAssets = new Map(); // sourceLower -> "previews/<file>"

		const distinctBgIndex = () => bgAssets.size; // 0 for the first distinct bg
		const distinctAudioIndex = () => audioAssets.size;

		const resolveBackground = (bgFilename) => {
			if (!bgFilename) return undefined;
			const key = bgFilename.toLowerCase();
			if (bgAssets.has(key)) return bgAssets.get(key);
			const entry = entries.find(e => e.entryName.toLowerCase() === key);
			if (!entry) { bgAssets.set(key, undefined); return undefined; }
			const ext = extname(bgFilename);
			// keep the first distinct bg at the legacy "<stem><ext>" name
			const idx = distinctBgIndex();
			const outName = idx === 0 ? `${name}${ext}` : `${name}-bg${idx}${ext}`;
			writeFileSync(join(previews, outName), entry.getData());
			const rel = `previews/${outName}`;
			bgAssets.set(key, rel);
			return rel;
		};

		const resolveAudio = (audioFilename, previewTimeMs) => {
			if (!audioFilename) return undefined;
			const key = audioFilename.toLowerCase();
			if (audioAssets.has(key)) return audioAssets.get(key);
			const entry = entries.find(e => e.entryName.toLowerCase() === key);
			if (!entry) { audioAssets.set(key, undefined); return undefined; }
			const audioExt = extname(audioFilename);
			const idx = distinctAudioIndex();
			// keep the first distinct preview at the legacy "<stem>.mp3" name
			const outName = idx === 0 ? `${name}.mp3` : `${name}-audio${idx}.mp3`;
			const outPath = join(previews, outName);
			const tempPath = join(previews, `${name}_temp${idx}${audioExt}`);
			writeFileSync(tempPath, entry.getData());
			const startTimeSec = previewTimeMs > 0 ? (previewTimeMs / 1000).toFixed(2) : '40.00';
			let rel;
			try {
				execSync(
					`ffmpeg -y -ss ${startTimeSec} -i "${tempPath}" -t 10 -c:a libmp3lame -q:a 4 "${outPath}"`,
					{ stdio: 'ignore' }
				);
				rel = `previews/${outName}`;
			} catch (ffmpegErr) {
				console.error(`  FFmpeg failed to create preview for ${setId}:`, ffmpegErr.message);
			} finally {
				if (existsSync(tempPath)) rmSync(tempPath);
			}
			audioAssets.set(key, rel);
			return rel;
		};

		// 3. Build versions[] with their own audio/background, computing star rating.
		parsed.forEach((info) => {
			const background = resolveBackground(info.bgFilename);
			const audio = resolveAudio(info.audioFilename, info.previewTimeMs);

			let stars = 0;
			let bpm = 0;
			let objects = 0;
			let rice = 0;
			let ln = 0;
			let total_length = 0;
			try {
				const map = new Beatmap(info.buffer);
				bpm = map.bpm;
				objects = map.nObjects;
				rice = map.nCircles;
				ln = map.nSliders;
				const calc = new Difficulty({ mode: 3 }); // force mania
				const attrs = calc.calculate(map);
				stars = attrs.stars;
				map.free();
			} catch (err) {
				console.error(`  Failed to calculate SR for ${info.version}:`, err.message);
			}

			// total_length is stored in milliseconds (consumers divide by 1000);
			// decode separately since rosu doesn't expose the playable length.
			try {
				total_length = decoder.decodeFromString(info.buffer.toString('utf8')).totalLength;
			} catch (err) {
				console.error(`  Failed to compute total_length for ${info.version}:`, err.message);
			}

			metadata.versions.push({
				id: info.mapId,
				runtime: false,
				version: info.version,
				difficulty: Math.round(stars * 100) / 100,
				mode: info.mode,
				keys: info.keys,
				total_length,
				audio,
				background,
				bpm,
				objects,
				rice,
				ln,
			});
		});

		metadata.id = setId;

		// set-level defaults (first difficulty) - fallback for older consumers
		metadata.background = metadata.versions.find(v => v.background)?.background;
		metadata.audio = metadata.versions.find(v => v.audio)?.audio;

		manifest.beatmaps.push(metadata);

		if (metadata.file.startsWith('355322 nekodex - circles!')) {
			manifest.intro = metadata;
		}

	} catch (err) {
		console.error(`Failed to process ${file}:`, err.message);
	}
});

writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log('Metadata and previews generated successfully.');