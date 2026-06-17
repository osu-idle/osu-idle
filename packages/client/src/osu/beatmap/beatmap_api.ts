import { unzip, Unzipped } from 'fflate';
import API from '../../online/api';
import BeatmapStore, { SetRecord } from './beatmap_store';

/**
 * Percent-encode a single path segment for both the Vite dev server and the
 * production static host. Vite decodes request paths with `decodeURI`, which
 * leaves the URI sub-delimiters (`& + $ , = @ : ;`) percent-encoded - so an
 * `encodeURIComponent` segment containing them would never match an on-disk
 * filename (the dev server falls through to the SPA index.html, which then
 * fails to unzip). Emit those chars raw (legal inside a path segment) and only
 * percent-encode what would otherwise break URL parsing (space, `#`, `?`, ...).
 */
function encodeSegment(seg: string): string {
	return encodeURIComponent(seg).replace(
		/%(26|2B|24|2C|3D|40|3A|3B)/g,
		(m) => decodeURIComponent(m),
	);
}

type Manifest = {
	intro: Metadata,
	beatmaps: Metadata[],
};

export type Metadata = {
	file: string,
	id: number,
	runtime: false,
	title: string,
	artist: string,
	creator: string,
	background: string,
	audio: string,
	versions: VersionMetadata[],
};

export type VersionMetadata = {
	id: number,
	runtime: false,
	version: string,
	difficulty: number,
	mode: number,
	keys: number,
	audio: string,
	background: string,
	total_length: number,
	bpm: number,
	objects: number,
	rice: number,
	ln: number,
};

export default class BeatmapAPI {

	private static manifest: Manifest;

	public static assetUrl(path: string | undefined): string | undefined {
		// keysound maps (AudioFilename: virtual) and bg-less maps have no asset -
		// return undefined rather than a bogus "<base>undefined" URL.
		if (!path) return undefined;
		// encode per segment: filenames carry '#', spaces, '[]' etc. (osu! set folders).
		return `${import.meta.env.BASE_URL}${path.split('/').map(encodeSegment).join('/')}`;
	}

	public static async getManifest(): Promise<Manifest> {
		return this.manifest ??= await (await API.fetch(`${import.meta.env.BASE_URL}beatmaps/manifest.json`)).json();
	}

	public static async downloadOsz(
		metadata: Metadata,
		onProgress?: (progress: number) => void,
	): Promise<SetRecord> {
		const existing = await BeatmapStore.getSet(metadata.id);
		if (existing) return existing;

		const res = await API.fetch(`${import.meta.env.BASE_URL}beatmaps/${encodeSegment(metadata.file)}.osz`);
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