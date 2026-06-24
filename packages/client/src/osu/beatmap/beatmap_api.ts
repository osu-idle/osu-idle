import {
	unzip,
	Unzipped,
} from 'fflate';
import type { InferResponseType } from 'hono/client';
import API from '../../online/api';
import {
	BASE_URL,
	rpc,
} from '../../online/client';
import BeatmapStore, { SetRecord } from './beatmap_store';

/** The live catalog and its metadata types, as returned by the server. */
export type Manifest = InferResponseType<typeof rpc.v1.beatmap.catalog.$get>;
export type Metadata = Manifest['beatmaps'][number];
export type VersionMetadata = Metadata['versions'][number];

export default class BeatmapAPI {

	private static manifest: Manifest;

	/** Resolve a catalog asset path (preview audio/background, already
	 *  server-rooted as `/v1/beatmap/preview/...`) to a full URL on the API. */
	public static assetUrl(path: string | undefined): string | undefined {
		if (!path) return undefined;
		return `${BASE_URL}${path}`;
	}

	public static async getManifest(): Promise<Manifest> {
		return this.manifest ??= await (await rpc.v1.beatmap.catalog.$get()).json();
	}

	public static async downloadOsz(
		metadata: Metadata,
		onProgress?: (progress: number) => void,
	): Promise<SetRecord> {
		const existing = await BeatmapStore.getSet(metadata.id);
		if (existing) return existing;

		const res = await API.fetch(`${BASE_URL}/v1/beatmap/osz/${metadata.id}`);
		const buf = await this.readWithProgress(res, onProgress);
		const files = await new Promise<Unzipped>((resolve, reject) => {
			unzip(buf, (err, data) => (err ? reject(err) : resolve(data)));
		});

		return await BeatmapStore.storeOsz(metadata, files);
	}

	/**
	 * Read a response body into a single buffer, reporting download progress
	 * (0..1) against Content-Length. Falls back to a plain arrayBuffer read when
	 * no callback is given or the body can't be streamed (e.g. length unknown).
	 */
	private static async readWithProgress(
		res: Response,
		onProgress?: (progress: number) => void,
	): Promise<Uint8Array> {
		const total = Number(res.headers.get('content-length')) || 0;
		if (!onProgress || !res.body || !total) {
			return new Uint8Array(await res.arrayBuffer());
		}

		const reader = res.body.getReader();
		const chunks: Uint8Array[] = [];
		let loaded = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			loaded += value.length;
			onProgress(loaded / total);
		}
		onProgress(1);

		const out = new Uint8Array(loaded);
		let offset = 0;
		for (const chunk of chunks) {
			out.set(chunk, offset);
			offset += chunk.length;
		}
		return out;
	}

	public static async isDownloaded(metadata: Metadata): Promise<boolean> {
		return BeatmapStore.has(metadata.id);
	}

}
