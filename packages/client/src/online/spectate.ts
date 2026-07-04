import type { PlayState } from '@osu-idle/shared/play';
import {
	fetchPlayResult,
	playState,
} from './play';
import Socket from './socket';
import SceneManager, { SCENE } from '../scenes/SceneManager';
import { launchPlay } from '../scenes/launchPlay';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import { Score } from '../db/schema/score';
import { ScoreXP } from '../db/schema/score_xp';
import { logPlayFinished } from '../logs';
import Entities from '../entity/entities';
import { message } from '../globals';
import { t } from '@lingui/core/macro';
import { music } from '../audio/MusicPlayer';
import Synced from '@osu-idle/shared/helpers/synced';

type ActivePlayState = Extract<PlayState, { phase: 'active' }>;

/** A live play the player quit without aborting, tracked for song select's
 *  resume banner. Timeline shifted into this client's clock. */
export type BackgroundPlay = {
	token: string;
	beatmap: LightBeatmap;
	startedAt: number;
	endsAt: number;
	accuracy?: number;
	grade?: ActivePlayState['grade'];
};

/**
 * Cross-device spectating. The server owns every ranked play and pushes its
 * state over the socket ({@link playState}); this reacts to it while the game
 * sits in song select:
 *  - an **active** play on a map we have downloaded → launch gameplay, which
 *    joins the play and seeks to its live position (resume after refresh, or a
 *    second tab/device following along).
 *  - a **finished** play whose result is still retrievable → show the result
 *    screen once (the player returned after it completed server-side).
 */
export default class Spectate {

	/** Play the player quit on purpose (without aborting): never auto-relaunch
	 *  it, but its result still shows when the server finalises it. */
	private static dismissedToken: string | undefined;
	public static dismiss(token: string): void {
		this.dismissedToken = token;
	}

	/** The dismissed play while it's still live - drives the resume banner. */
	public static background = new Synced<BackgroundPlay | undefined>(undefined);

	/** Token whose banner checkpoints this socket is watching. */
	private static watching: string | undefined;

	/** Finished token already surfaced, so a lingering state can't re-show it. */
	private static notified: string | undefined;

	private static started = false;
	public static start(): void {
		if (this.started) return;
		this.started = true;

		void Synced.all(
			[SceneManager.current, playState],
			() => void this.evaluate(),
		);
	}

	private static async evaluate(): Promise<void> {
		const state = playState.get();
		if (SceneManager.current.get() !== SCENE.SELECT || !state) {
			this.unwatch();
			return;
		}

		const character = Entities.character.get();
		if (!character || character.isGuest()) return;

		if (state.phase === 'active') {
			if (state.token === this.dismissedToken) {
				this.watch(state.token);
				await this.trackBackground(state);
			} else {
				this.unwatch();
				await this.spectate(state.beatmapId);
			}
			return;
		}
		this.unwatch();
		if (this.background.get()) void this.background.set(undefined);
		if (state.phase === 'finished' && state.notify && this.notified !== state.token) {
			this.notified = state.token;
			await this.showResult(state.token);
		}
	}

	/** Have the server push this play's live checkpoints (accuracy/grade) for
	 *  the resume banner. */
	private static watch(token: string): void {
		if (this.watching === token) return;
		this.watching = token;
		Socket.send({
			type: 'play:watch', token,
		});
	}

	private static unwatch(): void {
		if (!this.watching) return;
		this.watching = undefined;
		Socket.send({ type: 'play:unwatch' });
	}

	/** Keep the resume banner's state in sync with the dismissed live play. */
	private static async trackBackground(state: ActivePlayState): Promise<void> {
		const current = this.background.get();
		const same = current?.token === state.token;
		if (same
			&& current.accuracy === state.accuracy
			&& current.grade === state.grade) return;
		const beatmap = same
			? current.beatmap
			: await this.findDownloaded(state.beatmapId);
		if (!beatmap) return;
		const skew = Date.now() - state.serverNow;
		void this.background.set({
			token: state.token,
			beatmap,
			startedAt: state.startedAt + skew,
			endsAt: state.endsAt + skew,
			accuracy: state.accuracy,
			grade: state.grade,
		});
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
		if (!res || res.failed || !res.score) return;

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
		void ScoreXP.record(saved, res.gains);
		logPlayFinished(saved, beatmap, res.gains);
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
