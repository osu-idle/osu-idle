import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import SceneManager, { type Scene } from '../scenes/SceneManager';
import Entities from '../entity/entities';
import Account from '../online/account';
import PlayManager from '../online/playManager';
import PlayQueue from '../gameplay/playQueue';
import {
	currentLocalPlay,
	finishLocalPlay,
} from '../online/localPlay';
import BeatmapAPI from '../osu/beatmap/beatmap_api';
import BeatmapStore, { beatmapsVersion } from '../osu/beatmap/beatmap_store';
import { Score } from '../db/schema/score';
import { ScoreXP } from '../db/schema/score_xp';
import { SETTINGS } from '../db/settings';
import type Synced from '@osu-idle/shared/helpers/synced';

/**
 * Dev-only window handle the end-to-end suite (`packages/e2e`) drives the app
 * through. It reads the same state the UI reads, and its only write is the one
 * a browser cannot do from the outside: end a local play now instead of waiting
 * the song out. Everything else a test does, it does by clicking.
 *
 * Loaded from main.tsx behind `import.meta.env.DEV`, so a production build never
 * contains it.
 */

type SkillView = {
	name: SkillName;
	level: number;
	xp: number;
	upgrades: number;
	overdrive: number;
	prestige: number;
};

type CharacterView = {
	id: number;
	name: string;
	guest: boolean;
	generation: number;
	overallLevel: number;
	overallTotalXp: number;
	skills: SkillView[];
};

type PlayView = {
	token: string;
	beatmapId: number;
	mode?: string;
	startedAt: number;
	endsAt: number;
	remainingMs: number;
	accuracy?: number;
	grade?: string;
};

type ScoreView = {
	beatmapId: number;
	score: number;
	accuracy: number;
	maxCombo: number;
	grade: string;
	pp: number;
	pfc: boolean;
	playedAt: number;
};

const character = (): CharacterView => {
	const c = Entities.character.get();
	return {
		id: c.id,
		name: c.name,
		guest: c.isGuest(),
		generation: c.generation,
		overallLevel: c.overallLevel,
		overallTotalXp: c.overallTotalXp,
		skills: c.skills.map(s => ({
			name: s.name,
			level: s.level.get(),
			xp: s.xp.get(),
			upgrades: s.upgrades.get(),
			overdrive: s.overdrive.get(),
			prestige: s.prestige.get(),
		})),
	};
};

const play = (): PlayView | undefined => {
	const live = PlayManager.live.get();
	if (!live) return undefined;
	return {
		token: live.token,
		beatmapId: live.beatmap.metadata.id,
		mode: currentLocalPlay()?.mode,
		startedAt: live.startedAt,
		endsAt: live.endsAt,
		remainingMs: live.endsAt - Date.now(),
		accuracy: live.accuracy,
		grade: live.grade,
	};
};

const queue = () => {
	const state = PlayQueue.state.get();
	if (!state) return undefined;
	return {
		label: state.label,
		shuffle: state.shuffle,
		entries: state.entries.map(e => ({
			id: e.metadata.id,
			version: e.metadata.version,
			title: e.set.metadata.title,
		})),
	};
};

const scores = async (): Promise<ScoreView[]> => {
	const rows = await Score.query(
		'SELECT * FROM score WHERE characterId = ? ORDER BY playedAt DESC',
		[Entities.character.get().id],
	);
	return rows.map(s => ({
		beatmapId: s.beatmapId,
		score: s.score,
		accuracy: s.accuracy,
		maxCombo: s.maxCombo,
		grade: s.grade,
		pp: s.pp,
		pfc: s.pfc,
		playedAt: s.playedAt,
	}));
};

/** Every set the catalog offers, shortest first - a test picks a short map so
 *  the download and the play it runs stay cheap. */
const catalog = async () => {
	const manifest = await BeatmapAPI.getManifest();
	return manifest.beatmaps
		.map(m => ({
			id: m.id,
			title: m.title,
			artist: m.artist,
			versions: m.versions.map(v => ({
				id: v.id,
				version: v.version,
				length: v.total_length,
				objects: v.objects,
				keys: v.keys,
				mode: v.mode,
				difficulty: v.difficulty,
			})),
			length: Math.min(...m.versions.map(v => v.total_length)),
		}))
		.sort((a, b) => a.length - b.length);
};

/** Put a set in the local store without going through song select, for tests
 *  whose subject is not the download. */
const download = async (setId: number): Promise<number[]> => {
	const manifest = await BeatmapAPI.getManifest();
	const meta = manifest.beatmaps.find(m => m.id === setId);
	if (!meta) throw new Error(`no such set in the catalog: ${setId}`);
	await BeatmapAPI.downloadOsz(meta);
	void beatmapsVersion.set(beatmapsVersion.get() + 1);
	const set = (await BeatmapStore.getAllSets()).find(s => s.metadata.id === setId);
	return set?.getPlayableBeatmaps().map(b => b.metadata.id) ?? [];
};

const bridge = {
	/** the running play ends now, with the outcome it was born with */
	finishPlay: (): boolean => {
		const run = currentLocalPlay();
		if (!run) return false;
		finishLocalPlay(run.token);
		return true;
	},
	scene: (): Scene => SceneManager.current.get(),
	/** The session has answered *and* the live character it decided on is in
	 *  place - the placeholder is still there for a moment after it resolves. */
	sessionReady: (): boolean =>
		Account.resolved.get() && Entities.character.get().id !== 0,
	character,
	play,
	queue,
	countdown: (): number | undefined => PlayManager.countdown.get(),
	scores,
	/** Per-skill xp booked for each saved play, newest first. */
	xpGains: async () => {
		const rows = await ScoreXP.query(
			'SELECT * FROM score_xp WHERE characterId = ? ORDER BY playedAt DESC',
			[Entities.character.get().id],
		);
		return rows.map(row => ({
			scoreId: row.scoreId,
			beatmapId: row.beatmapId,
			gains: Object.fromEntries(
				Skills.map(s => [s, row[s]]).filter(([, gained]) => (gained as number) > 0),
			) as Partial<Record<SkillName, number>>,
		}));
	},
	catalog,
	download,
	sets: async (): Promise<number[]> =>
		(await BeatmapStore.getAllSets()).map(s => s.metadata.id),
	setting: (key: keyof typeof SETTINGS) => SETTINGS[key].get(),
	setSetting: async (key: keyof typeof SETTINGS, value: unknown): Promise<void> => {
		await (SETTINGS[key] as Synced<unknown>).set(value);
	},
};

export type TestBridge = typeof bridge;

declare global {
	interface Window { __idle?: TestBridge }
}

window.__idle = bridge;
