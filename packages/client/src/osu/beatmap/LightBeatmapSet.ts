import { CarouselItem } from '../../components/BeatmapCarousel';
import {
	Metadata,
	VersionMetadata,
} from './beatmap_api';
import {
	RuntimeMetadata,
	RuntimeVersionMetadata,
} from './beatmap_store';
import LightBeatmap from './LightBeatmap';

export default class LightBeatmapSet {
	
	public beatmaps: LightBeatmap[];

	constructor(
		public metadata: RuntimeMetadata | Metadata,
		beatmaps: LightBeatmap[] | (RuntimeVersionMetadata | VersionMetadata)[],
	) {
		if (beatmaps.length && !(beatmaps[0] instanceof LightBeatmap)) {
			this.beatmaps = beatmaps.map(m => 
				new LightBeatmap(this, m as RuntimeVersionMetadata | VersionMetadata),
			);
		} else {
			this.beatmaps = beatmaps as LightBeatmap[];
		}
	}

	public static fromMetadata(meta: Metadata | RuntimeMetadata): LightBeatmapSet {
		return new LightBeatmapSet(meta, meta.versions);
	}

	public getPlayableBeatmaps(): LightBeatmap[] {
		return this.beatmaps.filter(b => b.isPlayable());
	}

	
	public getCarouselItems(): CarouselItem[] {
		return this.getPlayableBeatmaps().map(beatmap => ({
			set: this, beatmap, 
		}));
	};

	public is(set?: LightBeatmapSet | number): boolean {
		return this.metadata.id === (typeof set === 'number' ? set : set?.metadata.id);
	}

}