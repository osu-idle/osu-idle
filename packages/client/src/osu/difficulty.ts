import * as ppjs from 'rosu-pp-js-web';
import BeatmapStore from './beatmap/beatmap_store';
import { Beatmap } from 'osu-classes';
import rosuReady from './rosu';

/** osu!'s star-rating colour spectrum, interpolated. */
const STOPS: [stars: number, rgb: [number, number, number]][] = [
	[0.1, [66, 144, 251]],
	[1.5, [79, 192, 255]],
	[2.0, [79, 255, 213]],
	[2.5, [124, 255, 79]],
	[3.3, [246, 240, 92]],
	[4.2, [255, 128, 104]],
	[4.9, [255, 78, 111]],
	[5.8, [198, 69, 184]],
	[6.7, [101, 99, 222]],
	[7.7, [24, 21, 142]],
];

export function difficultyColor(stars: number): string {
	if (stars <= STOPS[0][0]) return `rgb(${STOPS[0][1].join(',')})`;
	for (let i = 0; i < STOPS.length - 1; i++) {
		const [s0, c0] = STOPS[i];
		const [s1, c1] = STOPS[i + 1];
		if (stars <= s1) {
			const t = (stars - s0) / (s1 - s0);
			const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
			return `rgb(${c.join(',')})`;
		}
	}
	return '#1a1a2e'; // expert+
}

const calculateSR = async (beatmap: Beatmap): Promise<number> => {
	const osu = await BeatmapStore
		.getOsu(beatmap.metadata.beatmapSetId, beatmap.metadata.beatmapId);
	if (!osu) return 0;

	await rosuReady();
	return new ppjs.Difficulty({ lazer: false }).calculate(new ppjs.Beatmap(osu)).stars;
};

export default calculateSR;