import './Gameplay.css';
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import {
	Trans,
	useLingui,
} from '@lingui/react/macro';
import {
	LEAD_IN_MS,
	ManiaGame,
} from '@osu-idle/shared/sim/maniaGame';
import CharacterBot, { type SkillProgress } from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import type { Bot } from '@osu-idle/shared/sim/bot';
import { DEBUG_BOT_LEVEL } from '../gameplay/strainDebug';
import ReplayBot from '../gameplay/replayBot';
import {
	abortPlaySession,
	fetchPlayResult,
	PlayResultError,
	finishPlaySession,
	skipPlaySession,
	startPlaySession,
	type PlayContext,
} from '../online/play';
import Account from '../online/account';
import {
	abortLocalPlay,
	currentLocalPlay,
	finishLocalPlay,
	localPlayResult,
	startLocalPlay,
} from '../online/localPlay';
import Socket from '../online/socket';
import PlayManager from '../online/playManager';
import ContextMenu from '../components/ContextMenu';
import Entities from '../entity/entities';
import Character from '../db/schema/character';
import { hasUnlock } from '@osu-idle/shared/rebirth';
import {
	playReducer,
	startPlay,
	type PlayEffect,
	type PlayEvent,
	type PlayScoring,
	type PlayState,
} from '@osu-idle/shared/sim/playLifecycle';
import { Score } from '../db/schema/score';
import { ScoreXP } from '../db/schema/score_xp';
import { logPlayFinished } from '../logs';
import Memory from '@osu-idle/shared/sim/skills/memory';
import { Beatmap } from 'osu-classes';
import calculatePP from '../osu/pp';
import {
	music,
	PLAYER_MODE,
} from '../audio/MusicPlayer';
import {
	preloadDefaultHitsounds,
	preloadSamples,
	scheduleHitsound,
	stopScheduledHitsounds,
} from '../audio/hitsounds';
import { SampleSchedule } from '../audio/SampleSchedule';
import { effects } from '../audio/EffectPlayer';
import {
	assetKey,
	loadStoryboardAssets,
} from '../osu/beatmap/storyboard';
import BeatmapStore from '../osu/beatmap/beatmap_store';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import SceneManager, { SCENE } from './SceneManager';
import {
	Transition,
	DialogPanel,
} from './Transition';
import Controls from '../input/Controls';
import { debugMode } from '../globals';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import PlayQueue from '../gameplay/playQueue';
import SkipToEndButton from '../components/gameplay/SkipToEndButton';
import {
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import { skillName } from '@osu-idle/shared/display/skills';
import { type Grade } from '@osu-idle/shared/judgement';
import { currentSkin } from '../osu/skin/Skin';
import { SETTINGS } from '../db/settings';
import { scrollSpeedToMs } from '@osu-idle/shared/osu/scroll_speed';
import sleep from '@osu-idle/shared/helpers/sleep';
import GameplayRenderer, {
	type PlayfieldGeometry,
	type StrainHud,
} from '../gameplay/gameplayRenderer';

type InnerProps = {
	beatmapInfo: LightBeatmap,
	beatmap: Beatmap,
	play: PlayContext,
	/** prior plays of this map by the live character - seeds the memory skill */
	timesPlayed: number,
	transition: Transition,
};

/** approach time at base speed (ms a note is visible) lower = faster scroll */
/** how far ahead hitsounds are queued onto the audio clock. Must exceed the
 *  background timer-throttle floor (~1s) so a blurred tab still queues the next
 *  chunk before the previous one runs out - that's what keeps sound going. */
const HITSOUND_LOOKAHEAD_MS = 1500;
/** keep the scheduler ticking off the rAF loop so it runs while the tab is
 *  hidden (rAF is paused then; timers are merely throttled). */
const HITSOUND_TICK_MS = 250;

/** How long a ranked skip waits for the server to release the rest of the replay
 *  before finishing with whatever arrived. */
const SKIP_WAIT_MS = 5000;

/** How long to wait between asking the server for a result it is still storing.
 *  How many times is the machine's business (RESULT_ATTEMPTS). */
const RESULT_POLL_MS = 200;

/** How long a play may take to start before the cover gives up and says so.
 *  Longer than the session request's own timeout, so this only catches a step
 *  that has no timeout of its own - and the cover is opaque, so a boot that
 *  never finishes is a frozen screen with nothing on it. */
const BOOT_TIMEOUT_MS = 30_000;

function GameplayInner({
	beatmapInfo, 
	beatmap, 
	play,
	timesPlayed, 
	transition, 
}: InnerProps) {
	music.mode.set(PLAYER_MODE.SINGLE);

	const [skin] = useSynced(currentSkin);
	const [scrollSpeed] = useSynced(SETTINGS.scrollspeed);
	const SCROLL_MS = scrollSpeedToMs(scrollSpeed);
	const [debug] = useSynced(debugMode);
	const { i18n, t } = useLingui();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// background, storyboard video and the dim overlay are stacked DOM layers
	// behind the (transparent) playfield canvas: bg → video → dim → canvas. This
	// lets a native <video> play between the background and the playfield without
	// drawing it frame-by-frame, and mirrors osu's layer model.
	const bgRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const dimRef = useRef<HTMLDivElement>(null);
	// keysound + storyboard-sample schedulers (effects channel), and the set of
	// note times that carry a keysound (so the default hitsound is suppressed for
	// them). Built once the map's assets are decoded and preloaded.
	const sampleSchedRef = useRef<SampleSchedule | null>(null);
	const videoInfoRef = useRef<{ time: number } | null>(null);
	const [done, setDone] = useState(false);
	// live grade for the HUD badge - a DOM <img> overlaid on the canvas, so it is
	// React state pushed from the renderer only when the grade actually changes
	const [grade, setGrade] = useState<Grade>('X');
	const gameRef = useRef<ManiaGame | null>(null);
	// the play is over; the render loop switches to its outro clock so the
	// playfield stops tracking a song that has ended
	const forceFinishRef = useRef(false);
	const offsetCursorRef = useRef(0);
	const botRef = useRef<Bot | null>(null);
	// source of the strain HUD's per-skill values - the playing bot when the play
	// is simulated locally, or a display-only side analysis for ranked replays
	const strainBotRef = useRef<CharacterBot | null>(null);
	const skillLabels = useMemo(
		() => Object.fromEntries(Skills.map(s => 
			[s, skillName(s)],
		)) as Record<SkillName, string>,
		[i18n],
	);
	// clock state lives in a ref so it survives HMR effect re-runs: the lead-in
	// isn't restarted and the audio isn't re-triggered, keeping the gameplay
	// clock continuous with the (single, still-playing) audio.
	// `paused` holds the clock at the very start of the lead-in until the transition
	// has revealed the playfield - so gameplay doesn't begin behind the cover.
	// `pauseAt` holds the song clock frozen at a song position while paused
	const clockRef = useRef<{
		leadStart: number; 
		audioStarted: boolean;
		noAudio?: boolean;
		paused: boolean; 
		pauseAt?: number
	} | null>(null);
	// index into game.headHits of the next hitsound still to be queued. Persisted
	// across HMR re-runs so the scheduler resumes instead of re-queueing.
	const hitsoundPtr = useRef(0);
	// latest rendered song position (ms), so the debug transport controls (which
	// live outside the rAF effect) can read the current clock.
	const nowRef = useRef(0);
	// current visual scroll window (ms), read by the render loop each frame so a
	// mid-play scroll-speed change refreshes the playfield without re-running the
	// render effect (which would reset the rAF loop and re-bind listeners).
	const scrollMsRef = useRef(SCROLL_MS);
	scrollMsRef.current = SCROLL_MS;
	const [character] = useSynced(Entities.character);

	// playlist autopilot HUD: what plays next
	const [queue] = useSynced(PlayQueue.state);
	const nextUp = queue ? PlayQueue.next() : undefined;

	// every play but the debug one is owned by someone (the server, or the local
	// session) and keeps running whether or not this scene is watching it
	const owned = play.mode !== 'debug';

	// the dock reads the running play from the manager, which would otherwise
	// have to find this map by id in the beatmap store - a lookup that can miss
	useEffect(() => {
		if (owned) PlayManager.attach(play, beatmapInfo);
	}, []);

	// stop the play and leave (reached through the confirm menu)
	const abortPlay = () => {
		if (play.mode === 'ranked') void abortPlaySession(play.token);
		else if (owned) abortLocalPlay(play.token);
		dispatch({ type: 'abort' });
	};

	// quit: leave while the character keeps playing. Nothing to tell anyone -
	// the manager never re-enters gameplay on its own, so leaving stays left.
	const onQuit = () => onExit();

	// abort (default, Esc) asks for confirmation first; Esc again cancels
	const [confirmAbort, setConfirmAbort] = useState(false);
	const onAbort = () => setConfirmAbort(c => !c);

	Controls.back.usePress(onAbort);

	// build the game once; a freshly-built game starts a fresh clock so the two
	// always stay in lock-step (HMR preserves both refs → seamless resume)
	const ensureGame = () => {
		if (gameRef.current !== null || botRef.current !== null || !character) return;
		void preloadDefaultHitsounds();
		// seed the memory skill with this character's prior plays of the map before
		// any CharacterBot analyzes it (the side strain bot reads the same skills).
		character.skills.find(s => s instanceof Memory)?.timesPlayed.set(timesPlayed);
		// ranked play replays the server's exact offsets; guest / unranked play is
		// simulated locally from the character's skills; debug play uses the same
		// fixed-level bot as the strain debug view.
		botRef.current = play.mode === 'debug'
			? new CharacterBot(
				makeOrderedSkills(DEBUG_BOT_LEVEL),
				beatmap.difficulty.overallDifficulty,
			)
			: new ReplayBot(play.offsets);
		// scroll speed is a purely visual preference (applied below via pxPerUnit);
		// the bot's reading window must stay scroll-speed-independent so the same map
		// scores identically regardless of the player's chosen speed (and matches the
		// server, which constructs ManiaGame with the default window).
		const divine = hasUnlock(character.generation, 'DIVINE');
		gameRef.current = new ManiaGame(beatmap, botRef.current, {
			noFail: play.mode === 'debug', divine,
		});
		// ranked replays don't analyze strain locally - run a display-only analysis
		// of the same map with the character's skills (an approximation of the
		// server's authoritative play, for the strain HUD only)
		const local = owned && play.mode !== 'ranked'
			? currentLocalPlay()
			: undefined;
		if (botRef.current instanceof CharacterBot) {
			strainBotRef.current = botRef.current;
		} else if (local?.token === (owned ? play.token : '')) {
			// the play being watched *is* this analysis - no approximation needed
			strainBotRef.current = local.bot;
		} else {
			strainBotRef.current = new CharacterBot(
				character.skills, 
				beatmap.difficulty.overallDifficulty,
			);
			new ManiaGame(beatmap, strainBotRef.current, { divine });
		}
		clockRef.current = null;
		hitsoundPtr.current = 0;
	};
	ensureGame();
	const game = gameRef.current;

	// Gameplay owns the decoded buffer; when the play ends (finish, fail, or quit)
	// let the track keep playing to its natural end instead of cutting it, so the
	// result/select screens continue the same audio seamlessly. It hands back to
	// the streaming player on its own end, or as soon as a different song plays.
	const releaseAudio = () => {
		music.endGameplay();
	};

	const onExit = () => {
		releaseAudio();
		SceneManager.set(SCENE.SELECT);
	};

	// --- play lifecycle -----------------------------------------------------
	// The machine in shared/sim/playLifecycle decides what happens; everything
	// below only carries its effects out. Nothing here may end a play on its own:
	// dispatch an event and let the machine say so, or the endings drift apart
	// again.
	const lifecycleRef = useRef<PlayState>(startPlay(play.mode as PlayScoring));
	/** this client's own score, shown when nobody else owns the result */
	const localScoreRef = useRef<Score | undefined>(undefined);
	/** the authoritative result, once the server has one */
	const serverScoreRef = useRef<{ score: Score, gains?: SkillProgress[] } | undefined>(undefined);
	/** the play's token, which only a ranked play has */
	const rankedToken = play.mode === 'ranked' ? play.token : undefined;

	const dispatch = (event: PlayEvent) => {
		const from = lifecycleRef.current.phase;
		const stepped = playReducer(lifecycleRef.current, event);
		lifecycleRef.current = stepped.state;
		// one line per transition: what happened, where it moved, what it asked
		// for. If a play ever stalls again this says which phase it stalled in.
		console.log(`[play] ${event.type} | ${from} -> ${stepped.state.phase} | `
			+ (stepped.effects.map(e => e.type).join(' ') || 'no effects'), event);
		for (const effect of stepped.effects) {
			// an effect that throws must not vanish: without this the play stalls in
			// whatever phase it was in, with nothing on screen to say why
			void perform(effect).catch((e) => {
				console.error(`[play] effect ${effect.type} failed`, e);
				if (effect.type === 'build-local-score') {
					dispatch({
						type: 'local-ready', failed: gameRef.current?.score.failed ?? false,
					});
				}
			});
		}
	};

	/** Build this client's score for the play, and for a locally-scored one save
	 *  it and award its XP. pp must never gate it: a rejection here would leave
	 *  the play with nothing to show. */
	const buildLocalScore = async () => {
		const game = gameRef.current;
		if (!game) {
			// nothing to build from, but the machine still has to be told
			dispatch({
				type: 'local-ready', failed: false,
			});
			return;
		}
		const pp = await calculatePP(game.score, beatmap).catch((e) => {
			console.warn('[score] pp failed, finishing without it', e);
			return 0;
		});
		const c = game.score.counts;
		const failed = game.score.failed;
		const local = new Score({
			characterId: Number(character.id),
			beatmapId: beatmap.metadata.beatmapId,
			score: Math.round(game.score.score),
			accuracy: game.score.accuracy,
			maxCombo: game.score.maxCombo,
			...c,
			grade: game.score.grade,
			pp,
			ur: game.unstableRate(),
			pfc: c.MISS === 0 && c.BAD === 0 && c.GOOD === 0,
			playedAt: Date.now(),
		});
		localScoreRef.current = local;

		// The scene never saves: the play's owner does, once, whether or not
		// anyone watched. This score is only the fallback display for when the
		// owner cannot answer.
		dispatch({
			type: 'local-ready', failed,
		});
	};

	/** Read the local session's result, which exists the moment its clock runs
	 *  out. Polls the same way the ranked path does while it is still running. */
	const fetchLocalResult = async () => {
		if (play.mode === 'debug' || play.mode === 'ranked') return;
		const res = localPlayResult(play.token);
		if (!res) {
			await sleep(RESULT_POLL_MS);
			dispatch({
				type: 'owner-error', retryable: true,
			});
			return;
		}
		if (res.failed || !res.score) {
			dispatch({
				type: 'owner-result', hasScore: false,
			});
			return;
		}
		serverScoreRef.current = {
			score: res.score, gains: res.gains,
		};
		dispatch({
			type: 'owner-result', hasScore: true,
		});
	};

	/** Ask for the authoritative result. Polls rather than backing off - the wait
	 *  is the owner storing the play, which finishes when it finishes. */
	const fetchResult = async (attempt: number) => {
		if (!rankedToken) {
			await fetchLocalResult();
			return;
		}
		try {
			const result = await fetchPlayResult(rankedToken, true);
			console.log('[play] server result', JSON.stringify(result).slice(0, 160));
			if (result.failed || !('score' in result) || !result.score) {
				dispatch({
					type: 'owner-result', hasScore: false,
				});
				return;
			}
			// mirror the server's score locally so it shows in history/leaderboards
			const score = Score.fromDTO(result.score);
			logPlayFinished(score, beatmapInfo, result.gains);
			const saved = await score.add().catch((e) => {
				console.warn('[score] local mirror failed', e);
				return score;
			});
			void ScoreXP.record(saved, result.gains);
			serverScoreRef.current = {
				score: saved, gains: result.gains,
			};
			dispatch({
				type: 'owner-result', hasScore: true,
			});
		} catch (e) {
			// `unknown` means the result is gone for good (finalised then expired, or
			// a long AFK); anything else is worth asking again while it is stored
			const retryable = !(e instanceof PlayResultError && e.reason === 'unknown');
			console.warn(`[play] result attempt ${attempt} failed, retryable=${retryable}`, e);
			if (retryable) await sleep(RESULT_POLL_MS);
			else console.warn('[score] result gone, showing local replay', e);
			dispatch({
				type: 'owner-error', retryable,
			});
		}
	};

	const showResult = (source: 'owner' | 'local', failed: boolean) => {
		const game = gameRef.current;
		const server = serverScoreRef.current;
		if (source === 'owner' && server) {
			SceneManager.set(SCENE.RESULT, server.score, game ?? undefined, server.gains, false, beatmapInfo);
			return;
		}
		const local = localScoreRef.current;
		if (!local) {
			console.error('[score] no result to show, leaving gameplay');
			onExit();
			return;
		}
		// no progression to show: the owner computes it, and this is the path where
		// it could not be read
		SceneManager.set(SCENE.RESULT, local, game ?? undefined, undefined, failed, beatmapInfo);
	};

	/** The play ends here: judge whatever is left, and pull the local session's
	 *  clock in with it - its result is the one that will be shown, and waiting
	 *  the real map out would leave the skip hanging. */
	const resolveNow = () => {
		gameRef.current?.update(gameRef.current.songEndMs + 1000);
		if (owned && play.mode !== 'ranked') finishLocalPlay(play.token);
	};

	const perform = async (effect: PlayEffect) => {
		switch (effect.type) {
			case 'resolve-map':
				resolveNow();
				return;
			case 'stop-hitsounds':
				stopScheduledHitsounds();
				return;
			case 'release-audio':
				releaseAudio();
				return;
			case 'freeze-playfield':
				// the render loop switches to its outro clock, and the chrome swaps to
				// the finished state
				forceFinishRef.current = true;
				setDone(true);
				return;
			case 'mark-complete':
				if (owned) PlayManager.complete(play.token);
				return;
			case 'request-server-finish':
				if (rankedToken) void finishPlaySession(rankedToken, effect.cursor);
				// never let a skip wait forever on a reply that may not come
				window.setTimeout(() => dispatch({ type: 'replay-timeout' }), SKIP_WAIT_MS);
				return;
			case 'build-local-score':
				await buildLocalScore();
				return;
			case 'fetch-result':
				await fetchResult(effect.attempt);
				return;
			case 'show-result':
				showResult(effect.source, effect.failed);
				return;
			case 'exit':
				onExit();
				return;
		}
	};

	/** Debug: end the play now. What that means - resolve here, or ask the server
	 *  for the rest of the replay first - is the machine's call, not this one's. */
	const skipToEnd = () => {
		if (!gameRef.current) return;
		dispatch({
			type: 'skip', cursor: offsetCursorRef.current,
		});
	};

	const skipToStart = () => {
		if (!game) return;
		game.update(game.songStartMs);
		// the timeline belongs to the play's owner, so tell it we skipped
		if (play.mode === 'ranked') void skipPlaySession(play.token);
		const clock = clockRef.current;
		if (!clock) return;
		if (clock.noAudio) {
			// keysound maps run off the perf clock - slide its origin so it reads
			// songStartMs (there's no audio buffer to restart).
			clock.leadStart = performance.now() - LEAD_IN_MS - game.songStartMs;
		} else {
			// buffer maps: start (or restart) the track at the skipped-to position,
			// which re-anchors the audio clock there.
			clock.audioStarted = true;
			music.playGameplay(game.songStartMs);
		}
	};

	Controls.skip.usePress(() => {
		if ((game?.now() ?? Infinity) < ((game?.songStartMs ?? Infinity) - 2000))
			skipToStart();
	});

	// --- debug transport: pause/unpause + 10s seeks ---
	// re-queue hitsounds from song position `t`, dropping anything already scheduled
	// ahead on the audio clock
	const resyncHitsounds = (t: number) => {
		if (!game) return;
		stopScheduledHitsounds();
		let i = 0;
		while (i < game.headHits.length && game.headHits[i].time < t) i++;
		hitsoundPtr.current = i;
		sampleSchedRef.current?.resync(t);
	};
	// re-anchor a running clock so it reads song position `t` and resume audio there.
	const resumeAt = (clock: NonNullable<typeof clockRef.current>, t: number) => {
		if (clock.noAudio) {
			clock.leadStart = performance.now() - LEAD_IN_MS - t;
		} else {
			clock.audioStarted = true;
			music.playGameplay(t);
		}
		resyncHitsounds(t);
	};

	Controls.pause.usePress(() => {
		const clock = clockRef.current;
		if (!debug || !clock) return;
		if (clock.pauseAt === undefined) {
			clock.pauseAt = nowRef.current;
			music.pauseGameplay();
			stopScheduledHitsounds();
		} else {
			const t = clock.pauseAt;
			clock.pauseAt = undefined;
			resumeAt(clock, t);
		}
	});

	const seekBy = (delta: number) => {
		const clock = clockRef.current;
		if (!debug || !clock || !game) return;
		const cur = clock.pauseAt ?? nowRef.current;
		const t = Math.max(0, Math.min(cur + delta, game.songEndMs));
		game.seek(t);
		if (clock.pauseAt !== undefined) {
			clock.pauseAt = t;
			resyncHitsounds(t);
		} else {
			resumeAt(clock, t);
		}
	};
	Controls.seekForward.usePress(() => seekBy(10000));
	Controls.seekBack.usePress(() => seekBy(-10000));

	// A remote abort (another tab/device quitting this play) is pushed over the
	// socket - stop spectating and leave.
	useEffect(() => {
		if (play.mode !== 'ranked') return;
		return Socket.on('play:aborted', msg => {
			// through the machine: a play that already reached its result swallows
			// this instead of leaving the scene out from under the result screen
			if (msg.token === play.token) dispatch({ type: 'abort' });
		});
	}, []);

	// Stream the rest of the replay in. The server only revealed the first few
	// seconds at start (anti-cheat: the client must not know the outcome up
	// front); a `play:watch` arms the server-side feed that pushes the next
	// slices as they clear the reveal buffer, until every offset has arrived.
	// The feed dies with the socket, so it re-arms on every (re)connect from the
	// live cursor.
	useEffect(() => {
		if (play.mode !== 'ranked' || play.done) return;
		const bot = botRef.current;
		if (!(bot instanceof ReplayBot)) return;

		let cursor = play.next;
		// the skip reads this to tell the server where our replay got to; without
		// seeding it, a skip before the first pushed slice asks from 0 and the
		// answer re-appends offsets we already hold
		offsetCursorRef.current = cursor;
		let done = false;
		const offOffsets = Socket.on('play:offsets', msg => {
			if (msg.token !== play.token) return;
			// `done` latches to stop the feed re-appending, but a skip's answer has
			// to get through it: the server can report done with nothing to give
			// (an unknown token), and then this would drop the reply that finishes
			// the play
			if (done && lifecycleRef.current.phase !== 'awaiting-replay') return;
			if (msg.offsets.length) {
				gameRef.current?.appendReplay(bot.addOffsets(msg.offsets));
			}
			cursor = msg.next;
			offsetCursorRef.current = cursor;
			done = msg.done;

			dispatch({
				type: 'offsets', done: msg.done,
			});
		});
		const rewatch = (open: boolean) => {
			if (open && !done) Socket.send({
				type: 'play:watch', token: play.token, next: cursor,
			});
		};
		void Socket.connected.sync(rewatch);
		return () => {
			offOffsets();
			Socket.connected.desync(rewatch);
		};
	}, []);

	// decode + preload the map's keysounds and storyboard samples (effects channel)
	// and its storyboard video, then build the schedulers. Runs behind the lead-in
	// cover; until it resolves notes just play the default hitsound.
	useEffect(() => {
		let alive = true;
		let videoUrl: string | undefined;
		const setId = beatmapInfo.set.metadata.id;
		void (async () => {
			const assets = await loadStoryboardAssets(beatmapInfo, beatmap);
			if (!alive) return;
			sampleSchedRef.current = new SampleSchedule(assets.samples);
			// keysounds are played per note at press time (see queueHitsounds); only
			// the blobs need preloading here so they trigger with no latency.
			void preloadSamples(setId, [...assets.keysounds, ...assets.samples]);
			if (!assets.video) return;
			videoUrl = await BeatmapStore.getFileUrl(setId, assets.video.file);
			if (!alive || !videoUrl) {
				if (videoUrl) URL.revokeObjectURL(videoUrl);
				return;
			}
			if (videoRef.current) {
				videoInfoRef.current = { time: assets.video.time };
				videoRef.current.src = videoUrl;
			}
		})();
		return () => {
			alive = false;
			if (videoUrl) URL.revokeObjectURL(videoUrl);
		};
	}, [beatmap, beatmapInfo]);

	useEffect(() => {
		if (!game) return;
		const canvas = canvasRef.current!;
		const ctx = canvas.getContext('2d')!;
		const setId = beatmapInfo.set.metadata.id;
		const keys = game.keyCount;
		const fieldWidth = keys * skin.data.playfield.columnWidth;
		const mobile = window.innerWidth < 850;

		let w = 0;
		let h = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		// the whole gameplay frame (playfield + HUD) is drawn by the shared renderer;
		// this scene keeps the clock/audio plumbing and the play-only chrome
		const renderer = new GameplayRenderer(ctx, game, skin);

		const resize = () => {
			w = window.innerWidth;
			h = window.innerHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener('resize', resize);

		// background + storyboard video are DOM layers behind the transparent canvas.
		// Resolve the background image into its layer (cover-fit via CSS).
		let bgUrl: string | undefined;
		void BeatmapStore.getBeatmapBackground(beatmap).then((url) => {
			if (!url) return;
			bgUrl = url;
			if (bgRef.current) bgRef.current.style.backgroundImage = `url("${url}")`;
		});

		// keep the native storyboard video tracking the song clock. Plays natively;
		// only nudged when it drifts, when paused, or outside its time range - never
		// drawn per-frame. Hidden until its start and after it ends.
		let lastVideoNow = -Infinity;
		const syncVideo = (now: number) => {
			const video = videoRef.current;
			const info = videoInfoRef.current;
			if (!video || !info || !video.src) return;
			const target = (now - info.time) / 1000;
			const advancing = now > lastVideoNow;
			lastVideoNow = now;
			if (target < 0 || (video.duration && target > video.duration)) {
				video.style.display = 'none';
				if (!video.paused) video.pause();
				return;
			}
			video.style.display = '';
			if (!advancing) {
				if (!video.paused) video.pause();
				return;
			}
			if (video.paused) {
				video.currentTime = target;
				void video.play().catch(() => {});
			} else if (Math.abs(video.currentTime - target) > 0.25) {
				video.currentTime = target;
			}
		};

		const fieldX = () => (w - fieldWidth) / 2;

		// ---- clock: lead-in on a perf timer, then the audio position ----
		// persisted in a ref so an HMR effect re-run resumes the same clock
		// instead of restarting the lead-in (which would desync from the audio)
		if (!clockRef.current) {
			clockRef.current = { 
				leadStart: performance.now(), 
				audioStarted: false, 
				paused: true,
			};
			// keep the player's "current beatmap" set (results / menu read it) but stop
			// the streaming preview - gameplay plays a decoded buffer through the shared
			// audio context so the music stays sample-locked to the hitsounds.
			music.beatmap.set(beatmapInfo);
			music.stop();
			const c0 = clockRef.current;
			// decode the track now, during the silent lead-in, so it can start the
			// instant the clock crosses 0. `false` = keysound map (no backing track),
			// so the clock stays on the perf timer for the whole play.
			void music.prepareGameplay(beatmapInfo).then((hasAudio) => {
				c0.noAudio = !hasAudio;
				// Anchor the clock to the play's start time so every viewer shows the
				// exact same position: songPos = (now - startedAt) - lead-in. Computed
				// HERE, not earlier - the decode above can take a while, and a stale
				// anchor is what desyncs. A play joined mid-flight lands seeked.
				if (owned) {
					const t = (Date.now() - play.startedAt) - LEAD_IN_MS;
					c0.paused = false;
					if (t >= 0) {
						// already into the song - seek to the live position and start audio there
						const seekTo = Math.min(t, game.songEndMs + 1);
						game.seek(seekTo);
						resumeAt(c0, seekTo);
					} else {
						// still within the lead-in: anchor the countdown to wall-clock; audio
						// starts on its own when the clock crosses 0 (see songTime)
						c0.leadStart = performance.now() - LEAD_IN_MS - t;
					}
					void transition.reveal();
				}
			});
		}
		const clock = clockRef.current;
		const songTime = (): number => {
			// frozen at the start of the lead-in until the cover reveals the playfield
			if (clock.paused) return -LEAD_IN_MS;
			// debug pause: clock held at the song position it was paused on
			if (clock.pauseAt !== undefined) return clock.pauseAt;
			const t = performance.now() - clock.leadStart - LEAD_IN_MS;
			// still resolving whether this map has audio - hold just before the
			// start so notes don't begin before we know which clock to run.
			if (clock.noAudio === undefined) return Math.min(t, -0.001);
			// no backing track: the perf timer is the master clock for the whole song
			if (clock.noAudio) return t;
			// lead-in runs on a perf timer counting up to 0
			if (!clock.audioStarted) {
				if (t < 0) return t;
				// crossed 0 - start the buffer and hand the clock over to the audio clock
				clock.audioStarted = true;
				music.playGameplay(0);
			}
			// The buffer clock is derived from the AudioContext's own clock, so it
			// keeps advancing in real time even after the track ends (the track is
			// often shorter than the last note + 2s outro) - the final notes still get
			// judged and the result screen is reached, with no perf-timer fallback.
			return music.gameTime();
		};

		// Queue hitsounds onto the audio clock up to LOOKAHEAD ahead of the song
		// position. Because they're scheduled (not played reactively), they fire on
		// time even while the tab is blurred, and a tab that resumes after a gap
		// just advances the pointer past the now-stale hits (scheduleHitsound drops
		// anything already in the past) instead of dumping them all at once.
		const queueHitsounds = () => {
			if (finished) return;
			const now = songTime();
			const heads = game.headHits;
			while (
				hitsoundPtr.current < heads.length 
				&& heads[hitsoundPtr.current].time <= now + HITSOUND_LOOKAHEAD_MS
			) {
				const { time, note } = heads[hitsoundPtr.current++];
				if (time < now) continue; // already past - drop, don't fire late
				if (note.samples.length) {
					// a keysounded note plays its own sample(s) instead of the default
					for (const file of note.samples) {
						effects.play(assetKey(setId, file), { atMs: effects.now() + (time - now) });
					}
				} else {
					scheduleHitsound(time, now);
				}
			}
			sampleSchedRef.current?.queue(now, HITSOUND_LOOKAHEAD_MS);
		};
		// a timer (not rAF) so it keeps queueing while the tab is hidden
		const hitsoundTimer = setInterval(queueHitsounds, HITSOUND_TICK_MS);

		let raf = 0;
		let finished = false;
		let firstFrame = true;
		// once the play ends we keep the playfield scrolling under the result-loading
		// spinner instead of freezing. The song clock can stop advancing when the
		// track hands back to the streaming player, so drive this outro off a plain
		// perf timer anchored at the finish position.
		let outroFrom = 0;
		let outroAt = 0;

		// background fill, then the dimmed cover image. Dim is read live each
		// frame so the slider updates without needing a replay.
		// the canvas is transparent now (background + video are DOM layers below it);
		// just clear it and keep the dim overlay in sync with the live setting.
		let lastDim = -1;
		const drawBackground = () => {
			ctx.clearRect(0, 0, w, h);
			const dim = SETTINGS.backgroundDim.get();
			if (dim !== lastDim && dimRef.current) {
				lastDim = dim;
				dimRef.current.style.opacity = String(Math.max(0, Math.min(1, dim)));
			}
		};

		// play-only chrome the shared renderer doesn't draw: the skip prompt and the
		// per-mode label, both centred on the playfield via the returned geometry
		const drawChrome = (g: PlayfieldGeometry, now: number) => {
			const cxField = g.x0 + g.fieldWidth / 2;
			ctx.textAlign = 'center';

			if (now < (game.songStartMs - 2000) && game.songStartMs > 5000) {
				ctx.fillStyle = '#fff';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.fillText('SKIP', cxField, h * 0.62);
				ctx.fillText('>>>>', cxField, h * 0.64);
			}

			const label = play.mode === 'guest'
				? {
					text: 'Offline play', color: '#ffffff', 
				}
				: play.mode === 'unranked'
					? {
						text: 'Unranked', color: '#bb2727', 
					}
					: play.mode === 'debug'
						? {
							text: 'Debug bot - no fail', color: '#63b3ff', 
						}
						: undefined;
			if (label) {
				ctx.fillStyle = label.color;
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.fillText(label.text, cxField, h * 0.66);
			}
		};

		// the strain HUD source: the playing bot's analysis (set on every play)
		const strain = (): StrainHud | undefined =>
			strainBotRef.current
				? {
					bot: strainBotRef.current, labels: skillLabels, 
				}
				: undefined;

		const draw = () => {
			const now = finished ? outroFrom + (performance.now() - outroAt) : songTime();
			nowRef.current = now;
			game.update(Math.max(0, now));
			queueHitsounds();

			drawBackground();
			syncVideo(now);
			// the renderer derives its own geometry (picks up a live scroll-speed
			// change) and hands it back for the play-only chrome to align to
			const g = renderer.draw(now, {
				w,
				h,
				scrollMs: scrollMsRef.current,
			}, {
				debug,
				mobile,
				strain: strain(),
				onGrade: setGrade,
			});
			drawChrome(g, now);

			// end of map
			if (!finished 
				&& (forceFinishRef.current
					|| game.finished 
					// `now` is song position; a play's endsAt is wall clock. Comparing
					// the two is always false, which left the songEndMs fallback dead
					// and the scene relying on every note being judged.
					|| (now > game.songEndMs
						&& (play.mode === 'debug' || Date.now() > play.endsAt))
				)
			) {
				finished = true;
				// hand the outro clock the live song position so the playfield keeps
				// scrolling seamlessly while the result screen loads
				outroFrom = now;
				outroAt = performance.now();
				dispatch({ type: 'ended' });
			}

			// the playfield is now painted (frozen at the lead-in start). On a genuine
			// first launch - not an HMR resume, where the clock is already running -
			// fade the cover out, then release the clock so gameplay begins on a fully
			// revealed playfield rather than behind the cover. A ranked play reveals
			// itself once its clock is anchored to startedAt (see prepareGameplay), so
			// skip it here.
			if (firstFrame) {
				firstFrame = false;
				if (clock.paused && !owned) {
					void transition.reveal().then(() => {
						const c = clockRef.current;
						if (!c) return;
						c.leadStart = performance.now();
						c.paused = false;
					});
				}
			}

			// keep the loop running after the play ends so the playfield keeps
			// scrolling under the result-loading spinner; it's torn down by the effect
			// cleanup when the scene swaps to RESULT.
			raf = requestAnimationFrame(draw);
		};
		raf = requestAnimationFrame(draw);

		// tap/click the on-canvas "SKIP" prompt to jump to the song start. The
		// prompt is only live while it's actually drawn (before songStart - 2s),
		// matching the keyboard skip binding's gate.
		const onPointerDown = (e: PointerEvent) => {
			if (songTime() >= game.songStartMs - 2000) return;
			const rect = canvas.getBoundingClientRect();
			const px = e.clientX - rect.left;
			const py = e.clientY - rect.top;
			const cxField = fieldX() + fieldWidth / 2;
			// bounding box around the SKIP / >>>> text (drawn at h*0.62–0.64)
			if (Math.abs(px - cxField) < 90 && py > h * 0.56 && py < h * 0.68) 
				skipToStart();
		};
		canvas.addEventListener('pointerdown', onPointerDown);

		return () => {
			cancelAnimationFrame(raf);
			clearInterval(hitsoundTimer);
			// drop hitsounds queued ahead on the audio clock so they don't keep
			// firing after we leave (quit mid-play leaves up to LOOKAHEAD queued)
			stopScheduledHitsounds();
			window.removeEventListener('resize', resize);
			canvas.removeEventListener('pointerdown', onPointerDown);
			videoRef.current?.pause();
			if (bgUrl) URL.revokeObjectURL(bgUrl);
		};
	}, [game, debug, transition]);

	if (!game) return <div className="play" />;

	return (
		<div className="play">
			<div ref={bgRef} className="play__bg" />
			<video ref={videoRef} className="play__video" muted playsInline />
			<div ref={dimRef} className="play__dim" />
			<canvas ref={canvasRef} className="play__canvas" />
			{!done && skin.grade(grade, 'play__grade')}
			{done && play.mode === 'ranked' && (
				<div className="play__loading">
					<div className="play__loading-spinner" />
					<Trans>Submitting score…</Trans>
				</div>
			)}
			<div className="play__actions">
				<button
					className="play__abort"
					onClick={onAbort}
					title={t`Stop the play (Esc)`}
				>
					<Trans>abort</Trans>
				</button>
				{owned && (
					<button
						className="play__quit"
						onClick={onQuit}
						title={t`Leave - your character keeps playing`}
					>
						<Trans>quit</Trans>
					</button>
				)}
			</div>
			<div className="play__title">
				{beatmap.metadata.artist} - {beatmap.metadata.title}
				<span> [{beatmap.metadata.version}]</span>
			</div>

			{queue && (
				<div className="play__autopilot">
					<div className="play__autopilot-next">
						<Trans>Next up:</Trans> {nextUp
							? <>
								{nextUp.set.metadata.artist} - {nextUp.set.metadata.title}
								<span> [{nextUp.metadata.version}]</span>
							</>
							: '-'}
					</div>
				</div>
			)}

			<SkipToEndButton shown={debug && !done} onSkip={skipToEnd} />

			{confirmAbort && (
				<ContextMenu
					title={t`Abort the play?`}
					sub={`${beatmap.metadata.artist} - ${beatmap.metadata.title}`}
					onClose={() => setConfirmAbort(false)}
					options={owned
						? [
							{
								label: t`1. Abort`, color: '#e93100', onClick: abortPlay,
							},
							{
								label: t`2. Quit, keep playing`, color: '#85b81e', onClick: onQuit,
							},
							{
								label: t`3. Cancel`, color: '#6b6b6b', onClick: () => setConfirmAbort(false),
							},
						]
						: [
							{
								label: t`1. Abort`, color: '#e93100', onClick: abortPlay,
							},
							{
								label: t`2. Cancel`, color: '#6b6b6b', onClick: () => setConfirmAbort(false),
							},
						]}
				/>
			)}
		</div>
	);
}

/** Start or join the client-owned play for this map and describe it the way a
 *  ranked play is described: a replay with a live timeline. */
const localContext = async (
	character: Character,
	beatmapInfo: LightBeatmap,
	chart: Beatmap,
	mode: 'guest' | 'unranked',
): Promise<PlayContext> => {
	const run = await startLocalPlay(character, beatmapInfo, chart, mode);
	return {
		mode,
		token: run.token,
		beatmapId: run.beatmapId,
		offsets: run.offsets,
		startedAt: run.startedAt,
		endsAt: run.endsAt,
	};
};

type Props = {
	beatmapInfo: LightBeatmap,
	transition: Transition,
	/** dev: play with the debug bot, no-fail, never saved/submitted */
	debugPlay?: boolean,
};

/**
 * Loads a play behind the transition cover, then hands off to GameplayInner
 *
 * Runs the slow work - parse the beatmap, resolve the play session - while the
 * cover hides it, and routes the failure cases into the cover as dialogs (the
 * cover stays up, the user chooses what to do):
 *  - the beatmap won't load → offer to go back.
 *  - the server refused to rank → offer to play locally (unranked) or go back.
 *
 * On success it mounts GameplayInner, which builds the game, paints a frozen
 * first frame, then reveals the cover and starts the clock.
 */
export default function Gameplay({ 
	beatmapInfo,
	transition,
	debugPlay, 
}: Props) {
	const [boot, setBoot] = useState<{ 
		beatmap: Beatmap;
		play: PlayContext;
		timesPlayed: number 
	} | null>(null);
	// run the boot once; the ref survives HMR effect re-runs so a hot reload never
	// re-loads (and never mints a second server play session).
	const booted = useRef(false);
	const { t } = useLingui();

	useEffect(() => {
		// Run exactly once. The ref guard (not an effect-cleanup flag) is deliberate:
		// under StrictMode the effect mounts → unmounts → remounts, and a cleanup that
		// cancelled the in-flight boot would abort the only run, so the play would
		// never resolve. Surviving HMR re-runs also means we never mint a 2nd session.
		if (booted.current) return;
		booted.current = true;

		// nothing below is allowed to leave the cover up forever
		let settled = false;
		const done = () => {
			settled = true;
			window.clearTimeout(watchdog);
		};
		const watchdog = window.setTimeout(() => {
			if (settled) return;
			console.warn('[gameplay] boot timed out');
			void (async () => {
				await dialog<void>(resolve => (
					<DialogPanel
						title={t`Couldn't start play`}
						message={t`This play took too long to start.`}
						actions={[{
							label: t`Back`, onClick: () => resolve(),
						}]} />
				));
				SceneManager.set(SCENE.SELECT);
				await transition.reveal();
			})();
		}, BOOT_TIMEOUT_MS);

		// show interactive content over the fully-covered screen and await a choice
		// A dialog is the boot waiting on a person, which has no timeout worth
		// enforcing - and firing the watchdog here would put its own panel over
		// theirs and strand the promise nobody can answer any more.
		const dialog = <T,>(
			render: (resolve: (v: T) => void) => ReactNode,
		): Promise<T> => {
			done();
			return transition.covered.then(() => new Promise<T>(resolve => 
				transition.setContent(render(resolve)),
			));
		};

		// swap back to song select behind the cover, then fade it out to reveal it
		const backToSelect = async () => {
			SceneManager.set(SCENE.SELECT);
			await transition.reveal();
		};

		const fail = async (message: string) => {
			done();
			await dialog<void>(resolve => (
				<DialogPanel 
					title={t`Couldn't start play`} 
					message={message} 
					actions={[{ 
						label: t`Back`, 
						onClick: () => resolve(), 
					}]} />
			));
			await backToSelect();
		};

		void (async () => {
			let live: Beatmap;
			try {
				live = await beatmapInfo.load();
			} catch (e) {
				console.error('[gameplay] beatmap load failed', e);
				await fail(t`This difficulty failed to load.`);
				return;
			}
			if (live.hitObjects.length === 0) {
				await fail(t`This difficulty has no notes to play.`);
				return;
			}

			// debug play is purely local: no character validation, no server session.
			if (debugPlay) {
				done();
				setBoot({
					beatmap: live, play: { mode: 'debug' }, timesPlayed: 0, 
				});
				return;
			}

			// commit to a character before scoring - a play resolved mid-validation must
			// not be mis-scored. During server downtime this waits rather than guessing.
			await Account.ready();
			const character = Entities.character.get();
			let session = await startPlaySession(character, live.metadata.beatmapId);

			// start-or-join can hand back a play on a *different* map (quit without
			// abort, then launched another) - its replay wouldn't match this chart.
			// Offer to abort the running play or back out.
			if (session.mode === 'ranked' && session.beatmapId !== live.metadata.beatmapId) {
				const choice = await dialog<'abort' | 'cancel'>(resolve => (
					<DialogPanel
						title={t`Already playing`}
						message={
							t`Your character is still playing another map. Abort that play to start this one?`
						}
						actions={[
							{
								label: t`Abort it`, primary: true, onClick: () => resolve('abort'),
							},
							{
								label: t`Cancel`, onClick: () => resolve('cancel'),
							},
						]}
					/>
				));
				if (choice === 'cancel') {
					done();
					await backToSelect();
					return;
				}
				await abortPlaySession(session.token);
				session = await startPlaySession(character, live.metadata.beatmapId);
				if (session.mode === 'ranked' && session.beatmapId !== live.metadata.beatmapId) {
					await fail(t`Couldn't take over the running play.`);
					return;
				}
			}

			let play: PlayContext;
			if (session.mode === 'refused') {
				const choice = await dialog<'local' | 'cancel'>(resolve => (
					<DialogPanel
						title={t`Play unranked ?`}
						message={
							t`A game is already in progress. Play locally instead? It won't be submitted.`
						}
						actions={[
							{
								label: t`Play unranked`, primary: true, onClick: () => resolve('local'), 
							},
							{
								label: t`Cancel`, onClick: () => resolve('cancel'), 
							},
						]}
					/>
				));
				if (choice === 'cancel') {
					done();
					await backToSelect();
					return;
				}
				play = await localContext(character, beatmapInfo, live, 'unranked');
			} else if (session.mode === 'ranked') {
				play = session;
			} else {
				// start (or join) the local play, then watch it - the same shape the
				// server hands back for a ranked one
				play = await localContext(character, beatmapInfo, live, session.mode);
			}

			const timesPlayed = await Score.countPlays(
				character.id, 
				live.metadata.beatmapId,
				character.memoryResetAt,
			);
			done();
			setBoot({
				beatmap: live, play, timesPlayed, 
			});
		})();
	}, [beatmapInfo, transition, debugPlay, t]);

	// nothing to show until the play is resolved - the cover is hiding this anyway
	if (!boot) return <div className="play" />;
	return <GameplayInner 
		beatmapInfo={beatmapInfo} 
		beatmap={boot.beatmap}
		play={boot.play} 
		timesPlayed={boot.timesPlayed} 
		transition={transition} 
	/>;
}