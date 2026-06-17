import { Beatmap } from 'osu-classes';
import BeatmapAPI, { VersionMetadata } from './beatmap_api';
import BeatmapStore, { RuntimeVersionMetadata } from './beatmap_store';
import BeatmapSet from './beatmap_set';
import LightBeatmapSet from './LightBeatmapSet';
import { music } from '../../audio/MusicPlayer';

export default class LightBeatmap {

	constructor(
		public set: LightBeatmapSet,
		public metadata: RuntimeVersionMetadata | VersionMetadata,
	) {
	}

	public isPlayable(): boolean {
		return this.metadata.mode === 3 && this.metadata.keys === 4;
	}

	public isPlaying(): boolean {
		return this.is(music.beatmap.get());
	}

	public is(beatmap?: LightBeatmap | number): boolean {
		return this.metadata.id === (typeof beatmap === 'number' ? beatmap : beatmap?.metadata.id);
	}

	public async load(): Promise<Beatmap> {
		const set = new BeatmapSet(this.set.metadata.id);
		const maps = await set.beatmaps;
		if (!maps[this.metadata.id]) throw new Error(`Loaded invalid beatmap ${this.metadata.id} from set ${this.set.metadata.id}`);
		return maps[this.metadata.id];
	}

	public async getBackgroundUri(): Promise<string | undefined> {
		return this.metadata.runtime ? BeatmapStore.getBeatmapBackground(this) : BeatmapAPI.assetUrl(this.metadata.background);
	}

	public async getAudioUri(): Promise<string | undefined> {
		return this.metadata.runtime ? BeatmapStore.getBeatmapAudio(this) : BeatmapAPI.assetUrl(this.metadata.audio);
	}

}