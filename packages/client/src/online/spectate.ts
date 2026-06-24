import {
	getActivePlay,
	fetchPlayResult,
} from './play';
import SceneManager, { SCENE } from '../scenes/SceneManager';
import { launchPlay } from '../scenes/launchPlay';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { Score } from '../db/schema/score';
import Entities from '../entity/entities';
import { message } from '../globals';
import { t } from '@lingui/core/macro';
import { music } from '../audio/MusicPlayer';

/** How often the idle scenes check the server for a play or result to spectate. */
const POLL_MS = 4000;

/**
 * Cross-device spectating. The server owns every ranked play; this watches for
 * one while the game sits in an idle scene (song select / result) and:
 *  - an **active** play on a map we have downloaded → launch gameplay, which
 *    joins the play and seeks to its live position (resume after refresh, or a
 *    second tab/device following along).
 *  - a **finished** play whose result is still retrievable → show the result
 *    screen once (the player returned after it completed server-side).
 */
export default class Spectate {

	private static started = false;
	public static start(): void {
		if (this.started) return;
		this.started = true;

		setInterval(() => void this.tick(), POLL_MS);
		void this.tick();
	}

	public static async tick(): Promise<void> {
		const scene = SceneManager.current.get();
		if (scene !== SCENE.SELECT) return;

		const character = Entities.character.get();
		if (!character || character.isGuest()) return;

		const state = await getActivePlay();
		console.log(state);
		if (!state) return;
		if (state.active) {
			await this.spectate(state.beatmapId);
		} else if (
			'finished' in state
			&& state.finished
			&& 'notify' in state
			&& state.notify
		) {
			await this.showResult(state.token);
		}
	}

	/** Launch gameplay to spectate the active play, if we have its map downloaded.
	 *  Gameplay's boot joins the play and seeks to the live position itself. */
	private static async spectate(beatmapId: number): Promise<void> {
		const beatmap = await this.findDownloaded(beatmapId);
		if (beatmap) launchPlay(beatmap);
		else message.set(t`Could not start spectating, beatmap is not downloaded`);
	}

	/** Show (once) the result of a play that finished server-side, mirroring the
	 *  authoritative score locally - mirrors Gameplay's ranked finish path. */
	private static async showResult(token: string): Promise<void> {
		const res = await fetchPlayResult(token).catch(() => null);
		if (!res || res.failed || !('score' in res) || !res.score) return;

		const ch = Entities.character.get();
		for (const g of res.gains ?? []) {
			ch.skills.find(s => s.name === g.skill)?.level.set(g.toLevel);
			ch.skills.find(s => s.name === g.skill)?.xp.set(g.toXp);
		}
		void ch.persistSkills();

		const beatmap = await this.findDownloaded(res.score.beatmapId);
		if (!beatmap) return;
		music.beatmap.set(beatmap);

		const score = Score.fromDTO(res.score);
		const saved = await score.add().catch(() => score);
		SceneManager.set(SCENE.RESULT, saved, undefined, res.gains, false);
	}

	/** The downloaded (playable) difficulty for a beatmap id, or null. */
	private static async findDownloaded(
		beatmapId: number,
	): Promise<LightBeatmap | null> {
		for (const set of await BeatmapStore.getAllSets()) {
			const beatmap = set.beatmaps.find(b => b.metadata.id === beatmapId);
			if (beatmap) return beatmap;
		}
		return null;
	}
}