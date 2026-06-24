import {
	Beatmap,
	LayerType,
	Storyboard,
	StoryboardSample,
	StoryboardVideo,
} from 'osu-classes';
import { StoryboardDecoder } from 'osu-parsers';
import BeatmapStore from './beatmap_store';
import type LightBeatmap from './LightBeatmap';

// A timed sound on the effects channel: a storyboard sample or a note keysound.
export type SampleEvent = {
	time: number,
	/** stable EffectPlayer key (see assetKey) */
	key: string,
	/** set-relative asset path, as written in the beatmap */
	file: string,
	/** 0..1 playback volume */
	volume: number,
};

export type VideoInfo = {
	time: number,
	file: string,
};

export type StoryboardAssets = {
	/** storyboard sound samples, sorted by time */
	samples: SampleEvent[],
	/** per-note sounds (notes with no explicit sample omitted), sorted by time */
	keysounds: SampleEvent[],
	video?: VideoInfo,
};

const EMPTY: StoryboardAssets = {
	samples: [], keysounds: [], 
};

/** Stable EffectPlayer key for a set-relative asset path. Mirrors the file-store
 *  key normalization so the same blob always maps to one key. */
export const assetKey = (setId: number, file: string): string =>
	`sb:${setId}/${file.toLowerCase().replace(/\\/g, '/')}`;

// volume 0 in a sample means "inherit" - treat it as full for our purposes.
const vol = (v: number): number => (v > 0 ? v / 100 : 1);

const keysoundsFrom = (beatmap: Beatmap, setId: number): SampleEvent[] => {
	const out: SampleEvent[] = [];
	for (const obj of beatmap.hitObjects) {
		for (const s of obj.samples) {
			if (!s.filename) continue;
			out.push({ 
				time: obj.startTime, 
				key: assetKey(setId, s.filename),
				file: s.filename, 
				volume: vol(s.volume),
			});
		}
	}
	out.sort((a, b) => a.time - b.time);
	return out;
};

const collectSamples = (
	storyboard: Storyboard,
	setId: number, 
	out: SampleEvent[],
): void => {
	for (const layer of storyboard.layers.values()) {
		for (const el of layer.elements) {
			if (!(el instanceof StoryboardSample)) continue;
			out.push({ 
				time: el.startTime, key:
			 assetKey(setId, el.filePath), 
				file: el.filePath, 
				volume: vol(el.volume), 
			});
		}
	}
};

const videoFrom = (storyboard: Storyboard): VideoInfo | undefined => {
	const layer = storyboard.getLayerByType(LayerType.Video);
	const first = layer.elements
		.find((e): e is StoryboardVideo => e instanceof StoryboardVideo);
	return first && {
		time: first.startTime, file: first.filePath, 
	};
};

// The standalone StoryboardDecoder drops everything when fed a leading [Events]
// header (it disables the section it just entered), so feed it only the body
// lines of the .osb's [Events] section - the same shape the beatmap decoder uses
// internally for the inline storyboard.
const osbEventLines = (osb: string): string[] => {
	const out: string[] = [];
	let inEvents = false;
	for (const line of osb.split(/\r?\n/)) {
		const t = line.trim();
		if (t.startsWith('[') && t.endsWith(']')) {
			inEvents = t.toLowerCase() === '[events]';
			continue;
		}
		if (inEvents) out.push(line);
	}
	return out;
};

/**
 * Read a map's effects-channel assets: storyboard samples + video (the inline
 * .osu storyboard combined with its `.osb`, if any) and per-note keysounds.
 * Parse of the stored beatmap, never altered. Only runtime (downloaded) sets
 * carry the bundled files; others return empty.
 */
export const loadStoryboardAssets = async (
	light: LightBeatmap, 
	beatmap: Beatmap,
): Promise<StoryboardAssets> => {
	if (!light.metadata.runtime) return EMPTY;
	const setId = light.set.metadata.id;
	const keysounds = keysoundsFrom(beatmap, setId);

	const samples: SampleEvent[] = [];
	let video: VideoInfo | undefined;

	// inline (.osu) storyboard - already parsed by the beatmap decoder
	const inline = beatmap.events.storyboard;
	if (inline) {
		collectSamples(inline, setId, samples);
		video = videoFrom(inline);
	}

	// separate .osb storyboard, if the set bundled one
	const osbText = await BeatmapStore.getOsbText(setId);
	const lines = osbText ? osbEventLines(osbText) : [];
	if (lines.length) {
		try {
			const sb = new StoryboardDecoder().decodeFromLines(lines);
			collectSamples(sb, setId, samples);
			video ??= videoFrom(sb);
		} catch (e) {
			console.warn('[storyboard] .osb decode failed', e);
		}
	}

	samples.sort((a, b) => a.time - b.time);
	return {
		samples, keysounds, video, 
	};
};
