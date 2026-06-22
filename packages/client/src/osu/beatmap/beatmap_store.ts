import '@osu-idle/shared/osu/controlPointPatch';
import Synced from '@osu-idle/shared/helpers/synced';
import { Unzipped } from 'fflate';
import { Metadata } from './beatmap_api';
import { Beatmap } from 'osu-classes';
import { BeatmapDecoder } from 'osu-parsers';
import LightBeatmap from './LightBeatmap';
import LightBeatmapSet from './LightBeatmapSet';

const DB_NAME = 'beatmaps';
const DB_VERSION = 3;

const MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	wav: 'audio/wav',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
};

function mime(name: string): string {
	return MIME[name.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';
}

function fileKey(setId: number, name: string): string {
	return `${setId}/${name.toLowerCase()}`;
}

export type RuntimeMetadata = {
	id: number,
	runtime: true,
	title: string,
	artist: string,
	creator: string,
	background: string,
	audio: string,
	versions: RuntimeVersionMetadata[],
};

export type RuntimeVersionMetadata = {
	id: number,
	runtime: true,
	version: string,
	difficulty: number,
	mode: number,
	keys: number,
	audio: string,
	background: string,
	previewTime: number,
	total_length: number,
	bpm: number,
	objects: number,
	rice: number,
	ln: number,
};

/** Bumped whenever the stored library changes (e.g. a wipe), so views like the
 *  song-select carousel can reload off it. */
export const beatmapsVersion = new Synced(0);

export type SetRecord = {
	setId: number,
	metadata: RuntimeMetadata,
	osu: Record<number, string>,
};

let dbPromise: Promise<IDBDatabase> | undefined;
const db = (): Promise<IDBDatabase> => {
	return dbPromise ??= (() => {
		console.log('[beatmaps] db() opening...');
		return open().then(async (d) => {
			console.log('[beatmaps] open resolved, running data migrations');
			await runDataMigrations(d);
			console.log('[beatmaps] db() ready');
			return d;
		}).catch((err) => {
			console.error('[beatmaps] db() failed', err);
			dbPromise = undefined; // let the next caller retry instead of caching the failure
			throw err;
		});
	})();
};

/**
 * Open the store, (re)creating object stores on a structural version bump.
 * `onupgradeneeded` must stay purely structural and synchronous: it runs inside
 * the versionchange transaction, so any async work or error there aborts the
 * open and leaves the *entire* store unreachable until reset. Anything that
 * touches stored records (e.g. backfilling a new field) belongs in
 * `runDataMigrations`, which runs afterwards on the open DB and can't brick it.
 */
const open = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
	console.log(`[beatmaps] indexedDB.open(${DB_NAME}, v${DB_VERSION})`);
	const req = indexedDB.open(DB_NAME, DB_VERSION);
	req.onupgradeneeded = (event) => {
		const d = req.result;
		console.log(`[beatmaps] onupgradeneeded ${event.oldVersion} -> ${event.newVersion}; stores: [${Array.from(d.objectStoreNames)}]`);
		// Pre-v2 layouts are incompatible - drop and rebuild. v2→v3 added no
		// stores (total_length is data, backfilled below), so nothing to do there.
		if (event.oldVersion < 2) {
			for (const name of Array.from(d.objectStoreNames)) d.deleteObjectStore(name);
			d.createObjectStore('meta', { keyPath: 'id' });
			d.createObjectStore('charts');
			d.createObjectStore('files');
			console.log('[beatmaps] created stores meta/charts/files');
		}
	};
	req.onsuccess = () => {
		console.log(`[beatmaps] open onsuccess, version ${req.result.version}, stores: [${Array.from(req.result.objectStoreNames)}]`);
		resolve(req.result);
	};
	req.onerror = () => {
		console.error('[beatmaps] open onerror', req.error);
		reject(req.error);
	};
	// A connection still open at the old version (e.g. another tab) stalls the
	// upgrade indefinitely - fail loudly instead of hanging the whole game.
	req.onblocked = () => {
		console.error('[beatmaps] open onblocked - another tab/connection holds an older version');
		reject(new Error('beatmaps DB upgrade blocked by another open tab'));
	};
});

/**
 * Data migrations, mirroring the sql.js DAO (db/migrations.ts): an ordered list
 * run on the *open* database in ordinary transactions, gated by a counter in
 * localStorage. Unlike IndexedDB's structural versioning a failure here only
 * retries next load - it can't make the store unreachable. Each must be
 * idempotent; append to ship a new one, never edit a released entry in place.
 */
type DataMigration = (d: IDBDatabase) => Promise<void>;

const DATA_VERSION_KEY = 'beatmaps.dataVersion';

const dataMigrations: DataMigration[] = [
	backfillTotalLength,
	backfillTopMetadata,
];

async function runDataMigrations(d: IDBDatabase): Promise<void> {
	let version = 0;
	try {
		version = Number(localStorage.getItem(DATA_VERSION_KEY)) || 0;
	} catch { /* localStorage unavailable: re-run from 0, migrations are idempotent */ }

	console.log(`[beatmaps] data migrations at v${version}, target v${dataMigrations.length}`);
	for (let v = version; v < dataMigrations.length; v++) {
		console.log(`[beatmaps] running data migration ${v} -> ${v + 1}`);
		await dataMigrations[v](d);
		try {
			localStorage.setItem(DATA_VERSION_KEY, String(v + 1));
		} catch { /* ignore */ }
		console.log(`[beatmaps] data migration ${v} -> ${v + 1} done`);
	}
}

const withStore = <T>(d: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
	new Promise<T>((resolve, reject) => {
		const r = fn(d.transaction(store, mode).objectStore(store));
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => reject(r.error);
	});

/**
 * Backfill `total_length` by decoding the .osu text already held in `charts`,
 * rather than forcing a re-download. Idempotent: skips versions that already
 * have it, and a chart that fails to decode is left for a later re-download
 * instead of aborting the run.
 */
async function backfillTotalLength(d: IDBDatabase): Promise<void> {
	const metas = await withStore(d, 'meta', 'readonly', (s) => s.getAll()) as RuntimeMetadata[];
	const decoder = new BeatmapDecoder();
	console.log(`[beatmaps] backfillTotalLength: ${metas.length} sets`);

	let updated = 0;
	for (const meta of metas) {
		const osu = await withStore(d, 'charts', 'readonly', (s) => s.get(meta.id)) as Record<number, string> | undefined;
		if (!osu) {
			console.warn(`[beatmaps] no charts for set ${meta.id}, skipping`);
			continue;
		}

		let changed = false;
		for (const version of meta.versions) {
			if (typeof version.total_length === 'number') continue;
			const text = osu[version.id];
			if (text === undefined) continue;
			try {
				version.total_length = decoder.decodeFromString(text).totalLength;
				changed = true;
			} catch (err) {
				console.error(`[beatmaps] total_length backfill failed for ${meta.id}/${version.id}`, err);
			}
		}
		if (changed) {
			await withStore(d, 'meta', 'readwrite', (s) => s.put(meta));
			updated++;
		}
	}
	console.log(`[beatmaps] backfillTotalLength: updated ${updated} sets`);
}

async function backfillTopMetadata(d: IDBDatabase): Promise<void> {
	const metas = await withStore(d, 'meta', 'readonly', (s) => s.getAll()) as RuntimeMetadata[];
	const decoder = new BeatmapDecoder();
	console.log(`[beatmaps] backfillTopMetadata: ${metas.length} sets`);

	let updated = 0;
	for (const meta of metas) {
		const osu = await withStore(d, 'charts', 'readonly', (s) => s.get(meta.id)) as Record<number, string> | undefined;
		if (!osu) {
			console.warn(`[beatmaps] no charts for set ${meta.id}, skipping`);
			continue;
		}

		let changed = false;
		for (const version of meta.versions) {
			// if (typeof version.bpm === 'number') continue;
			const text = osu[version.id];
			if (text === undefined) continue;
			try {
				const beatmap = decoder.decodeFromString(text);
				version.bpm = beatmap.bpm;
				version.objects = beatmap.hitObjects.length;
				version.rice = beatmap.hitObjects.filter(h => h.hitType === 1).length;
				version.ln = beatmap.hitObjects.filter(h => h.hitType === 128).length;
				changed = true;
			} catch (err) {
				console.error(`[beatmaps] top metadata backfill failed for ${meta.id}/${version.id}`, err);
			}
		}
		if (changed) {
			await withStore(d, 'meta', 'readwrite', (s) => s.put(meta));
			updated++;
		}
	}
	console.log(`[beatmaps] backfillTopMetadata: updated ${updated} sets`);
}

const request = async <T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
	console.log(`[beatmaps] request ${mode} on '${store}'`);
	return db().then((d) => new Promise<T>((resolve, reject) => {
		const r = fn(d.transaction(store, mode).objectStore(store));
		r.onsuccess = () => resolve(r.result);
		r.onerror = () => {
			console.error(`[beatmaps] request error on '${store}'`, r.error);
			reject(r.error);
		};
	}));
};

export default class BeatmapStore {

	public static async storeOsz(metadata: Metadata, files: Unzipped): Promise<SetRecord> {
		const lookup = new Map(Object.keys(files).map((n) => [n.toLowerCase(), n]));
		const decoder = new TextDecoder();
		
		const runtimeMetadata: RuntimeMetadata = {
			id: metadata.id,
			runtime: true,
			artist: metadata.artist,
			creator: metadata.creator,
			title: metadata.title,
			versions: [],

			// placeholders, overwritten below from the actual .osu files
			audio: metadata.audio ?? '',
			background: metadata.background ?? '',
		};

		const media = new Set<string>();
		const osu = Object.keys(files)
			.filter(file => file.toLowerCase().endsWith('.osu'))
			.reduce((set, file) => {
				const text = decoder.decode(files[file]);
				const beatmap = (new BeatmapDecoder()).decodeFromString(text);
				const meta = metadata.versions.find(v => v.id === beatmap.metadata.beatmapId)!;

				set[beatmap.metadata.beatmapId] = text;
				if (beatmap.general.audioFilename) media.add(beatmap.general.audioFilename);
				if (beatmap.events.backgroundPath) media.add(beatmap.events.backgroundPath);

				runtimeMetadata.audio = beatmap.general.audioFilename;
				if (beatmap.events.backgroundPath) runtimeMetadata.background = beatmap.events.backgroundPath;

				runtimeMetadata.versions.push({
					id: beatmap.metadata.beatmapId,
					runtime: true,
					audio: beatmap.general.audioFilename,
					background: beatmap.events.backgroundPath ?? runtimeMetadata.background,
					difficulty: meta.difficulty,
					keys: beatmap.difficulty.circleSize,
					mode: beatmap.mode,
					version: beatmap.metadata.version,
					previewTime: beatmap.general.previewTime,
					total_length: beatmap.totalLength,
					bpm: beatmap.bpm,
					objects: beatmap.hitObjects.length,
					rice: beatmap.hitObjects.filter(h => h.hitType === 1).length,
					ln: beatmap.hitObjects.filter(h => h.hitType === 128).length,
				});
				return set;
			}, {} as Record<number, string>);

		const d = await db();
		await new Promise<void>((resolve, reject) => {
			const tx = d.transaction(['meta', 'charts', 'files'], 'readwrite');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);

			tx.objectStore('meta').put(runtimeMetadata);
			tx.objectStore('charts').put(osu, metadata.id);

			const fs = tx.objectStore('files');
			for (const name of media) {
				const real = lookup.get(name?.toLowerCase());
				if (!real) continue;
				fs.put(new Blob([files[real]], { type: mime(real) }), fileKey(metadata.id, name));
			}
		});

		return { setId: metadata.id, metadata: runtimeMetadata, osu };
	}

	public static async has(setId: number): Promise<boolean> {
		return (await request('meta', 'readonly', (s) => s.getKey(setId))) !== undefined;
	}

	/** Wipe every downloaded set (metadata, charts and media) and notify views. */
	public static async deleteAll(): Promise<void> {
		const d = await db();
		await new Promise<void>((resolve, reject) => {
			const tx = d.transaction(['meta', 'charts', 'files'], 'readwrite');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.objectStore('meta').clear();
			tx.objectStore('charts').clear();
			tx.objectStore('files').clear();
		});
		void beatmapsVersion.set(beatmapsVersion.get() + 1);
	}

	/** Delete one downloaded set (its metadata, charts and media) and notify
	 *  views. Files are keyed `${setId}/<name>`, so a prefix range drops them all. */
	public static async deleteSet(setId: number): Promise<void> {
		const d = await db();
		await new Promise<void>((resolve, reject) => {
			const tx = d.transaction(['meta', 'charts', 'files'], 'readwrite');
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.objectStore('meta').delete(setId);
			tx.objectStore('charts').delete(setId);
			const files = tx.objectStore('files');
			const cursor = files.openKeyCursor(IDBKeyRange.bound(`${setId}/`, `${setId}/\uffff`));
			cursor.onsuccess = () => {
				const c = cursor.result;
				if (!c) return;
				files.delete(c.primaryKey);
				c.continue();
			};
		});
		void beatmapsVersion.set(beatmapsVersion.get() + 1);
	}

	public static async getBeatmapSet(setId: number): Promise<LightBeatmapSet | undefined> {
		const meta = await request('meta', 'readonly', (s) => s.get(setId)) as RuntimeMetadata | undefined;
		if (!meta) return;
		return LightBeatmapSet.fromMetadata(meta);
	}

	public static async getAllSets(): Promise<LightBeatmapSet[]> {
		const metas = (await request('meta', 'readonly', (s) => s.getAll())) as RuntimeMetadata[];
		return metas.map(meta => LightBeatmapSet.fromMetadata(meta));
	}

	public static async getSet(setId: number): Promise<SetRecord | undefined> {
		const mapset = await this.getBeatmapSet(setId);
		if (!mapset || !mapset.metadata.runtime) return undefined;
		const osu = await request<Record<number, string>>('charts', 'readonly', (s) => s.get(setId));
		return { setId, metadata: mapset.metadata, osu };
	}

	public static async getOsu(setId: number, beatmapId: number): Promise<string | undefined> {
		const osu = await request<Record<number, string> | undefined>('charts', 'readonly', (s) => s.get(setId));
		return osu?.[beatmapId];
	}

	public static async getFileUrl(setId: number, name: string): Promise<string | undefined> {
		const blob = await request<Blob | undefined>('files', 'readonly', (s) => s.get(fileKey(setId, name)));
		return blob && URL.createObjectURL(blob);
	}

	public static getBeatmapAudio(beatmap: Beatmap | LightBeatmap): Promise<string | undefined> {
		if (beatmap instanceof LightBeatmap && !beatmap.metadata.runtime) return beatmap.getAudioUri();
		const audio = beatmap instanceof LightBeatmap ? beatmap.metadata.audio : beatmap.general.audioFilename;
		const set = beatmap instanceof LightBeatmap ? beatmap.set.metadata.id : beatmap.metadata.beatmapSetId;
		return audio ? this.getFileUrl(set, audio) : Promise.resolve(undefined);
	}

	public static getBeatmapBackground(beatmap: Beatmap | LightBeatmap): Promise<string | undefined> {
		if (beatmap instanceof LightBeatmap && !beatmap.metadata.runtime) return beatmap.getBackgroundUri();
		const bg = beatmap instanceof LightBeatmap ? beatmap.metadata.background : beatmap.events.backgroundPath;
		const set = beatmap instanceof LightBeatmap ? beatmap.set.metadata.id : beatmap.metadata.beatmapSetId;
		return bg ? this.getFileUrl(set, bg) : Promise.resolve(undefined);
	}

}
