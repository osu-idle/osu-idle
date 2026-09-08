import type { PlayState } from '@osu-idle/shared/play';
import {
	abortPlaySession,
	fetchPlayResult,
	playState,
	startPlaySession,
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
import Account from './account';
import { message } from '../globals';
import { t } from '@lingui/core/macro';
import { music } from '../audio/MusicPlayer';
import Synced from '@osu-idle/shared/helpers/synced';
import PlayQueue from '../gameplay/playQueue';
import { SETTINGS } from '../db/settings';
import {
	abortLocalPlay,
	currentLocalPlay,
	localPlayResult,
	localPlayState,
	pollLocalPlay,
	startLocalPlay,
	type LocalPlayState,
} from './localPlay';

type ActivePlayState = Extract<PlayState, { phase: 'active' }>;

/** What came of trying to start the head of the queue: it is playing, something
 *  else is (so the queue keeps its place), or it did not start. */
type StartResult = 'started' | 'elsewhere' | 'failed';

/** Consecutive failed starts before the queue stops trying. A refusal that
 *  clears on its own is worth another go; an anti-cheat lock or an offline
 *  client never does, and retrying those forever is a popup every two seconds. */
const MAX_START_FAILURES = 3;

/** The play the character is running right now, in this client's clock. */
export type LivePlay = {
	token: string;
	beatmap: LightBeatmap;
	startedAt: number;
	endsAt: number;
	accuracy?: number;
	grade?: ActivePlayState['grade'];
};

/**
 * Owns the character's plays, from anywhere.
 *
 * The server runs a ranked play on its own clock and pushes its state, so the
 * gameplay scene is only ever a viewer. This reacts to that state wherever the
 * player happens to be: it keeps the dock fed, mirrors results, and chains the
 * next map of the queue when one ends - none of which needs a scene to be
 * mounted. Leaving gameplay no longer stops anything.
 *
 * It never drags the player onto the playfield. Not for a play it started, and
 * not for one that turns up from elsewhere (another device, a reload mid-play):
 * both show in the dock, and `watch` is how you join them. Leaving gameplay has
 * to mean leaving - anything that re-enters on its own makes quitting look
 * broken, because it is.
 */
export default class PlayManager {

	/** The running play, for the dock and the resume banner. */
	public static live = new Synced<LivePlay | undefined>(undefined);

	/** Seconds until the queue starts the next map, while one is pending. */
	public static countdown = new Synced<number | undefined>(undefined);

	/** Paused: the running play finishes, and nothing follows it until resumed.
	 *  Different from clearing - the queue keeps everything in it. */
	public static paused = new Synced(false);

	public static setPaused(paused: boolean): void {
		void this.paused.set(paused);
		if (paused) {
			// hold what was left rather than sending it back to the start - the
			// button reads as "stop the countdown", not "restart it". Captured
			// before the cancel, which is what wipes it.
			const left = this.countdown.get();
			this.cancelChain();
			this.remaining = left;
			return;
		}
		// resuming with nothing playing starts the next map rather than waiting
		// for something to end first
		if (!this.live.get()) this.scheduleNext();
	}

	/** Play this client has already shown a result for. The server keeps
	 *  reporting a play active until its record is consumed, and finalising a big
	 *  one takes a moment - without this, returning to song select relaunches the
	 *  play that just ended. */
	private static completedToken: string | undefined;
	public static complete(token: string): void {
		this.completedToken = token;
	}

	/** Maps of plays this client started, by token. A play resolves its own map
	 *  through the beatmap store, which is a lookup that can come up empty (the
	 *  store still opening, a set list not yet read) - and nothing re-triggers
	 *  afterwards, so the dock would say nothing was playing for the whole play.
	 *  Whoever starts a play already has the map; it says so here. */
	private static known = new Map<string, LightBeatmap>();
	public static attach(
		play: { token: string, startedAt: number, endsAt: number },
		beatmap: LightBeatmap,
	): void {
		this.known.set(play.token, beatmap);
		// one play at a time: anything older is finished with
		for (const key of this.known.keys()) {
			if (key !== play.token) this.known.delete(key);
		}
		// and say so now. Waiting for a pushed state to arrive means the dock can
		// sit on "nothing playing" for the whole play if that push is missed, which
		// also silently breaks everything reading from it.
		if (this.live.get()?.token === play.token) return;
		void this.live.set({
			token: play.token,
			beatmap,
			startedAt: play.startedAt,
			endsAt: play.endsAt,
		});
	}

	/** Token whose checkpoints this socket is watching. */
	private static watching: string | undefined;

	/** Finished token already surfaced, so a lingering state can't re-show it. */
	private static notified: string | undefined;

	private static chainTimer: number | undefined;
	private static tickTimer: number | undefined;
	/** Skip asked for the next map now, without the between-plays delay. */
	private static immediate = false;
	/** What was left of a countdown when the queue was paused, so resuming holds
	 *  it rather than sending it back to the start. */
	private static remaining: number | undefined;
	private static failures = 0;
	/** The play we last saw running, whether or not its map could be resolved. */
	private static ranToken: string | undefined;

	private static started = false;
	public static start(): void {
		if (this.started) return;
		this.started = true;

		void Synced.all(
			[SceneManager.current, playState, localPlayState],
			() => void this.evaluate(),
		);
	}

	private static async evaluate(): Promise<void> {
		const scene = SceneManager.current.get();
		const character = Entities.character.get();
		if (!character) return;

		// a play this client owns takes precedence: while one runs, it *is* the
		// character's play, and the server has nothing to say about it
		const local = localPlayState.get();
		if (local) {
			this.evaluateLocal(local, scene);
			return;
		}

		const state = playState.get();
		// A guest has no server state ever, and its local play has just told us it
		// is gone by clearing its own - so this is where a guest's play ends, and
		// it has to end here the same way a server one does below.
		if (!state || character.isGuest()) {
			this.unwatch();
			// A dropped socket clears the state too, and the play it was reporting
			// is still running on the server. Ending here would clear the dock and
			// start chaining against it - and a long outage would then pause the
			// queue on failed starts.
			if (!character.isGuest() && !Socket.connected.get()) return;
			void this.endedHere();
			return;
		}

		if (state.phase === 'active') {
			// Already resulted, just not yet consumed server-side. From here that is
			// an ending like any other - and it is checked before cancelling, since
			// a second push for the same finished play would otherwise wipe the
			// countdown its first one started and nothing would reschedule.
			if (state.token === this.completedToken) {
				this.unwatch();
				await this.endedHere();
				return;
			}
			// a play is running: nothing to chain into yet
			this.cancelChain();
			// gameplay draws the play itself; anywhere else the dock needs the
			// server's checkpoints to show accuracy and grade
			this.ranToken = state.token;
			if (scene === SCENE.GAME) this.unwatch();
			else this.watch(state.token);
			await this.trackLive(state);
			return;
		}

		this.unwatch();
		// awaited: the result below carries the levels as they were *before* the
		// play's parked purchases spent them, so the two must not race
		await this.endedHere();
		if (state.phase === 'finished' && state.notify && this.notified !== state.token) {
			this.notified = state.token;
			await this.consumeResult(state.token, scene);
		}
	}

	/**
	 * Nothing is running any more. Drop the dock, re-read the character if a play
	 * had been holding it (that is the moment the server has applied whatever the
	 * play deferred, and the only moment worth a round trip), and let the queue
	 * take it from there.
	 */
	private static async endedHere(): Promise<void> {
		// `live` alone is not enough: a play on a map this client cannot resolve
		// (another device, a set never downloaded) never reaches the dock, and its
		// ending would then chain nothing.
		const ended = !!this.live.get() || !!this.ranToken;
		this.ranToken = undefined;
		this.clearLive();
		// Only a play that actually ended pulls the queue along. evaluate runs on
		// every scene change too, and chaining from those would start a background
		// play the moment an idle player walked between screens - the cold start is
		// what startNow is for.
		if (!ended) return;
		// A guest has no server-side character to re-read. For everyone else this is
		// the authority on the levels: a result's gains name what the play left,
		// before anything it deferred was spent, so nothing writes those back.
		// A failed read must not take the chain below with it - nothing else would
		// ever retry it.
		if (!Entities.character.get()?.isGuest()) {
			await Account.refresh().catch(e => console.warn('[queue] refresh failed', e));
		}
		this.scheduleNext();
	}

	/** The local session's twin of the server-state path: same dock, same
	 *  chaining, no socket. */
	private static evaluateLocal(state: LocalPlayState, scene: string): void {
		this.unwatch();

		if (state.phase === 'active') {
			this.cancelChain();
			this.pollLocal(true);
			this.ranToken = state.token;
			const run = currentLocalPlay();
			if (run) {
				void this.live.set({
					token: state.token,
					beatmap: run.beatmap,
					startedAt: state.startedAt,
					endsAt: state.endsAt,
					accuracy: state.accuracy,
					grade: state.grade,
				});
			}
			return;
		}

		// finished: the session already built, saved and paid for it. Clearing the
		// state hands the character back to the server's view for the next play.
		this.pollLocal(false);
		void localPlayState.set(undefined);
		if (scene === SCENE.SELECT) this.showLocalResult(state.token);
		void this.endedHere();
	}

	/** A local play has no socket pushing checkpoints, so its live accuracy and
	 *  grade are read off its own samples on a timer. */
	private static localTicker: number | undefined;
	private static pollLocal(on: boolean): void {
		if (on === (this.localTicker !== undefined)) return;
		if (!on) {
			window.clearInterval(this.localTicker);
			this.localTicker = undefined;
			return;
		}
		this.localTicker = window.setInterval(() => pollLocalPlay(), 1000);
	}

	private static showLocalResult(token: string): void {
		const res = localPlayResult(token);
		if (!res || res.failed || !res.score) return;
		music.beatmap.set(res.beatmap);
		SceneManager.set(SCENE.RESULT, res.score, undefined, res.gains, false, res.beatmap);
	}

	// --- the queue ----------------------------------------------------------

	/** Start the next map once the delay is up. The play the player is watching
	 *  ends on the result screen, so the countdown is visible there; started from
	 *  anywhere else it just happens. */
	private static scheduleNext(): void {
		if (this.chainTimer !== undefined) return;
		if (this.paused.get()) return;
		if (!PlayQueue.next()) return;

		const delay = this.immediate
			? 0
			: this.remaining ?? Math.max(0, SETTINGS.autopilotDelay.get());
		this.immediate = false;
		this.remaining = undefined;
		let left = Math.round(delay);
		void this.countdown.set(left);
		this.tickTimer = window.setInterval(() => {
			left = Math.max(0, left - 1);
			void this.countdown.set(left);
		}, 1000);
		this.chainTimer = window.setTimeout(() => {
			this.cancelChain();
			void this.playNext();
		}, delay * 1000);
	}

	private static cancelChain(): void {
		if (this.chainTimer !== undefined) window.clearTimeout(this.chainTimer);
		if (this.tickTimer !== undefined) window.clearInterval(this.tickTimer);
		this.chainTimer = undefined;
		this.tickTimer = undefined;
		// only a pause sets this, and it captures the value before calling here
		this.remaining = undefined;
		if (this.countdown.get() !== undefined) void this.countdown.set(undefined);
	}

	/**
	 * Run the head of the queue - in the background when the player is elsewhere,
	 * in the gameplay scene when that is where they already are.
	 *
	 * The queue only moves on once the play is actually running. Advancing first
	 * and hoping meant a launch that quietly did nothing (a wedged guard, a map
	 * that would not load) rotated the queue and stopped the loop dead, with the
	 * countdown sitting at zero and nothing to say why.
	 */
	private static async playNext(): Promise<void> {
		const next = PlayQueue.next();
		if (!next) return;
		// scoped to the one skip that asked for it: the paths that do not go
		// through scheduleNext would otherwise leave it set for the next play
		this.immediate = false;

		const scene = SceneManager.current.get();
		const started: StartResult = scene === SCENE.GAME || scene === SCENE.RESULT
			? (launchPlay(next) ? 'started' : 'failed')
			: await this.startInBackground(next);

		if (started === 'started') {
			this.failures = 0;
			PlayQueue.advance(next);
			return;
		}
		// something else is playing: the queue is intact and its ending chains
		if (started === 'elsewhere') {
			this.failures = 0;
			return;
		}
		console.warn('[queue] could not start', next.metadata.version);
		if (++this.failures >= MAX_START_FAILURES) {
			this.failures = 0;
			message.set(t`Could not start the next map - the queue is paused`);
			this.setPaused(true);
			return;
		}
		this.retry();
	}

	/** Re-arm the chain after a failed start, without the full between-plays wait. */
	private static retry(): void {
		this.cancelChain();
		this.chainTimer = window.setTimeout(() => {
			this.cancelChain();
			void this.playNext();
		}, 2000);
	}

	/**
	 * Start a play without a scene: the server simulates and runs it, and its
	 * pushed state is all this client needs. A map the server won't rank has no
	 * background form yet, so it falls back to the gameplay scene.
	 */
	private static async startInBackground(beatmap: LightBeatmap): Promise<StartResult> {
		const character = Entities.character.get();
		const beatmapId = beatmap.metadata.id;
		const session = await startPlaySession(character, beatmapId);
		if (session.mode === 'ranked') {
			// start-or-join: another tab or device may already have a play running,
			// and the server hands that one back instead. It is not this map, so the
			// queue keeps it - and the play that *is* running will pull the queue
			// along when it ends, the way any other play does.
			if (session.beatmapId !== beatmapId) return 'elsewhere';
			this.attach(session, beatmap);
			return 'started';
		}
		// Refused covers an anti-cheat lock *and* any connection error or timeout.
		// Either way this is a background start: the caller decides what to say,
		// rather than pulling the player onto the playfield for a dialog they
		// never asked for.
		if (session.mode === 'refused') return 'failed';

		const chart = await beatmap.load().catch(() => undefined);
		if (!chart) return 'failed';
		// the simulation reads the local database and walks the whole map: a throw
		// here would reject playNext, which every caller fires and forgets, and the
		// loop would stop with nothing but an unhandled rejection to show for it
		try {
			await startLocalPlay(character, beatmap, chart, session.mode);
		} catch (e) {
			console.warn('[queue] local play failed to start', e);
			return 'failed';
		}
		return 'started';
	}

	/** Start the queue now. A queue built while nothing is playing has nothing to
	 *  wait for - no play is going to end and pull it along - so this is what
	 *  gets it going. */
	public static startNow(): void {
		void this.paused.set(false);
		this.cancelChain();
		void this.playNext();
	}

	/** Drop the running play and go straight to the next one. The abort clears
	 *  the play state, which is what actually triggers the chain - routing it
	 *  through the one path stops a skip and a natural end from both advancing. */
	public static async skip(): Promise<void> {
		const live = this.live.get();
		this.cancelChain();
		this.immediate = true;
		if (!live) {
			void this.playNext();
			return;
		}
		// Both aborts end the play by clearing its state, and that lands in
		// endedHere, which chains - immediately, since `immediate` is set. Doing it
		// here as well would run two chains, and the queue would advance twice.
		if (localPlayState.get()) {
			abortLocalPlay(live.token);
			return;
		}
		await abortPlaySession(live.token);
	}

	// --- server state -------------------------------------------------------

	/** Have the server push this play's live checkpoints (accuracy/grade). */
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

	private static clearLive(): void {
		if (this.live.get()) void this.live.set(undefined);
	}

	/** Keep the dock's view of the running play in sync. */
	private static async trackLive(state: ActivePlayState): Promise<void> {
		const current = this.live.get();
		const same = current?.token === state.token;
		if (same
			&& current.accuracy === state.accuracy
			&& current.grade === state.grade) return;
		const beatmap = same
			? current.beatmap
			: this.known.get(state.token) ?? await this.findDownloaded(state.beatmapId);
		if (!beatmap) return;
		const skew = Date.now() - state.serverNow;
		void this.live.set({
			token: state.token,
			beatmap,
			startedAt: state.startedAt + skew,
			endsAt: state.endsAt + skew,
			accuracy: state.accuracy,
			grade: state.grade,
		});
	}

	/** Take a finished play's authoritative result: shown on the result screen
	 *  when the player is sitting in song select waiting for it, mirrored quietly
	 *  when they are off doing something else. */
	private static async consumeResult(token: string, scene: string): Promise<void> {
		// The scene marks a play complete when it tears down: it has shown the
		// result and logged it, and doing either again is one score reported twice.
		// While it is still up it owns the result even though it has not said so
		// yet - a sweep finalising first would otherwise mirror the score here and
		// the scene would mirror it again on its own ending.
		if (token === this.completedToken || scene === SCENE.GAME) return;
		const res = await fetchPlayResult(token).catch(() => null);
		if (!res || res.failed || !res.score) return;

		const beatmap = await this.findDownloaded(res.score.beatmapId);
		if (!beatmap) return;

		const score = Score.fromDTO(res.score);
		const saved = await score.add().catch(() => score);
		void ScoreXP.record(saved, res.gains);
		logPlayFinished(saved, beatmap, res.gains);

		if (scene !== SCENE.SELECT) return;
		music.beatmap.set(beatmap);
		SceneManager.set(SCENE.RESULT, saved, undefined, res.gains, false, beatmap);
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
