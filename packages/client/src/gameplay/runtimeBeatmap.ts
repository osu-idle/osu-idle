import { Beatmap } from 'osu-classes';
import Synced from '@osu-idle/shared/helpers/synced';
import calculateSR from '../osu/difficulty';

export default class RuntimeBeatmap {

	public readonly stars = new Synced(0);

	constructor(
		public beatmap: Beatmap,
		cachedSR?: number,
	) {
		if (cachedSR) {
			this.stars.set(cachedSR);
		}
	}

	public async updateSR() {
		this.stars.set(await calculateSR(this.beatmap));
	}

}