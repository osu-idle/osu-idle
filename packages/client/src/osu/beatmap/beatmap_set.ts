import '@osu-idle/shared/osu/controlPointPatch';
import { Beatmap } from 'osu-classes';
import BeatmapAPI from './beatmap_api';
import BeatmapStore, { SetRecord } from './beatmap_store';
import { BeatmapDecoder } from 'osu-parsers';
import LightBeatmapSet from './LightBeatmapSet';

export default class BeatmapSet {

	private record?: SetRecord;
	
	constructor(
		public id: number,
	) {}

	private async getRecord(): Promise<SetRecord> {
		const existing = this.record
			??= await BeatmapStore.getSet(this.id);

		if (existing) return existing;
		
		const metadata = (await BeatmapAPI.getManifest())
			.beatmaps.find(m => m.id === this.id);

		if (!metadata) {
			throw new Error(`Tried to get set with invalid id ${this.id}`);
		}

		return BeatmapAPI.downloadOsz(metadata);				
	}

	private _beatmaps?: Promise<Record<number, Beatmap>>;
	get beatmaps(): Promise<Record<number, Beatmap>> {
		return this._beatmaps ??= this.getRecord().then(r => Object.entries(r.osu)
			.reduce((set, [id, text]) => {
				set[Number(id)] = (new BeatmapDecoder()).decodeFromString(text);
				return set;
			}, {} as Record<number, Beatmap>)
		);
	}

	public static async getIntro(): Promise<LightBeatmapSet> {
		return LightBeatmapSet.fromMetadata((await BeatmapAPI.downloadOsz((await BeatmapAPI.getManifest()).intro)).metadata);
	}

}