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
import CharacterBot from '@osu-idle/shared/sim/bots/character';
import { makeOrderedSkills } from '@osu-idle/shared/sim/skills/factory';
import type { Bot } from '@osu-idle/shared/sim/bot';
import { DEBUG_BOT_LEVEL } from '../gameplay/strainDebug';
import ReplayBot from '../gameplay/replayBot';
import {
	abortPlaySession,
	fetchPlayOffsets,
	fetchPlayResult,
	playSessionHeartbeat,
	PlayResultError,
	skipPlaySession,
	startPlaySession,
	type PlayContext,
} from '../online/play';
import Account from '../online/account';
import Entities from '../entity/entities';
import { drawHitErrorBar } from '../gameplay/hitError';
import { Score } from '../db/schema/score';
import Reading from '@osu-idle/shared/sim/skills/reading';
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
import useAsync from '@osu-idle/shared/hooks/useAsync';
import Speed from '@osu-idle/shared/sim/skills/speed';
import num from '@osu-idle/shared/display/num';
import accuracy from '@osu-idle/shared/display/accuracy';
import { getCharacter } from '../online/services/characters';
import Autopilot from '../gameplay/autopilot';
import {
	SKILL,
	Skills,
	type SkillName,
} from '@osu-idle/shared/skills';
import { skillName } from '@osu-idle/shared/display/skills';
import { type Grade } from '@osu-idle/shared/judgement';
import { currentSkin } from '../osu/skin/Skin';
import { drawHpBar } from '../gameplay/hpBar';
import { MAX_HP } from '@osu-idle/shared/sim/scoring';
import { SETTINGS } from '../db/settings';
import { scrollSpeedToMs } from '@osu-idle/shared/osu/scroll_speed';
import sleep from '@osu-idle/shared/helpers/sleep';
import {
	Color,
	colorA,
} from '@osu-idle/shared/types/color';

type InnerProps = {
	beatmapInfo: LightBeatmap,
	beatmap: Beatmap,
	play: PlayContext,
	/** prior plays of this map by the live character - seeds the memory skill */
	timesPlayed: number,
	transition: Transition,
};

// --- playfield tuning (skinning will replace these later) ---
const COLUMN_WIDTH = 74;
const NOTE_HEIGHT = 24;
const RECEPTOR_HEIGHT = 30;
const JUDGE_LINE_FROM_BOTTOM = 100;
/** approach time at base speed (ms a note is visible) lower = faster scroll */
/** how far ahead hitsounds are queued onto the audio clock. Must exceed the
 *  background timer-throttle floor (~1s) so a blurred tab still queues the next
 *  chunk before the previous one runs out - that's what keeps sound going. */
const HITSOUND_LOOKAHEAD_MS = 1500;
/** keep the scheduler ticking off the rAF loop so it runs while the tab is
 *  hidden (rAF is paused then; timers are merely throttled). */
const HITSOUND_TICK_MS = 250;
/** how often a ranked play pulls the next slice of its streamed replay offsets.
 *  Well under the server's reveal buffer so the play never out-runs its data. */
const STREAM_POLL_MS = 1500;

// skills whose live strain is meaningful to watch - the rest are hidden from
// the strain HUD (accuracy is a level constant; memory has no press strain of
// its own - it only reduces SpeedJam's)
const STRAIN_HUD_HIDDEN = new Set<SkillName>([
	SKILL.accuracy, 
	SKILL.memory, 
	SKILL.consistency,
]);
const STRAIN_HUD_SKILLS = Skills.filter(s => !STRAIN_HUD_HIDDEN.has(s));

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
	const { i18n } = useLingui();
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
	// React state pushed from the render loop only when the grade actually changes
	const [grade, setGrade] = useState<Grade>('X');
	const gradeRef = useRef<Grade>('X');
	const savedRef = useRef(false);
	const gameRef = useRef<ManiaGame | null>(null);
	const botRef = useRef<Bot | null>(null);
	// source of the strain HUD's per-skill values - the playing bot when the play
	// is simulated locally, or a display-only side analysis for ranked replays
	const strainBotRef = useRef<CharacterBot | null>(null);
	// eased gauge values, so per-note strain jumps read as motion
	const strainDisplay = useRef<Record<SkillName, number>>(
		Object.fromEntries(Skills.map(s => [s, 0])) as Record<SkillName, number>,
	);
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

	// playlist autopilot HUD: what plays next, and the character's live fatigue
	// (server-side only - a guest has none). The result screen flushes the
	// character cache after each play, so loops show the climbing fatigue.
	const [autopilot] = useSynced(Autopilot.session);
	const nextUp = autopilot ? Autopilot.next() : null;
	const online = useAsync(async () => 
		character.id > 1 ? getCharacter(character.id) : undefined
	, [character]);

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
		botRef.current = play.mode === 'ranked'
			? new ReplayBot(play.offsets)
			: play.mode === 'debug'
				? new CharacterBot(
					makeOrderedSkills(DEBUG_BOT_LEVEL),
					beatmap.difficulty.overallDifficulty,
				)
				: new CharacterBot(character.skills, beatmap.difficulty.overallDifficulty);
		// scroll speed is a purely visual preference (applied below via pxPerUnit);
		// the bot's reading window must stay scroll-speed-independent so the same map
		// scores identically regardless of the player's chosen speed (and matches the
		// server, which constructs ManiaGame with the default window).
		gameRef.current = new ManiaGame(beatmap, botRef.current, { noFail: play.mode === 'debug' });
		// ranked replays don't analyze strain locally - run a display-only analysis
		// of the same map with the character's skills (an approximation of the
		// server's authoritative play, for the strain HUD only)
		if (botRef.current instanceof CharacterBot) {
			strainBotRef.current = botRef.current;
		} else {
			strainBotRef.current = new CharacterBot(
				character.skills, 
				beatmap.difficulty.overallDifficulty,
			);
			new ManiaGame(beatmap, strainBotRef.current);
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

	const onQuit = () => {
		if (play.mode === 'ranked') void abortPlaySession(play.token);
		onExit();
	};

	// debug: resolve the whole map instantly and jump to the result screen
	const skipToEnd = () => {
		if (!game) return;
		game.update(game.songEndMs + 1000); // judge every remaining note
		music.playGameplay(game.songEndMs + 1000);
		setDone(true);
	};

	const skipToStart = () => {
		if (!game) return;
		game.update(game.songStartMs);
		// a ranked play's timeline is server-authoritative; persist the skip too
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

	// finalise the play once it's over - the path depends on how it was scored:
	//  - ranked:   the server is authoritative signal completion and show its result
	//  - guest:    save locally and award XP from the local simulation
	//  - unranked: save locally only (no XP)
	useEffect(() => {
		if (!done || !game || savedRef.current) return;
		savedRef.current = true;
		const c = game.score.counts;
		const failed = game.score.failed;

		void calculatePP(game.score, beatmap).then(async pp => {
			// a local Score built from this client's (replayed or simulated) play -
			// used as-is for guest/unranked, and as the fail-screen display for ranked
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

			// debug play: never saved, submitted, or XP-bearing - just show the result
			if (play.mode === 'debug') {
				SceneManager.set(SCENE.RESULT, local, game, undefined, false);
				return;
			}

			if (play.mode === 'ranked') {
				// the ranked play is a deterministic replay of the server's offsets, so
				// `local` already reproduces the server's exact score - show it whenever
				// the authoritative result can't be fetched (gone server-side, or the
				// server unreachable) so the player still reaches their result screen.
				const showLocal = () => SceneManager.set(
					SCENE.RESULT, 
					local, 
					game, 
					undefined, 
					failed,
				);

				const handleRanked = async (tries = 0) => {
					try {
						const result = await fetchPlayResult(play.token, true);

						if (result.failed || !('score' in result) || !result.score) {
							SceneManager.set(SCENE.RESULT, local, game, undefined, true);
							return;
						}

						const ch = Entities.character.get();
						for (const g of result.gains ?? []) {
							ch.skills.find(s => s.name === g.skill)?.level.set(g.toLevel);
							ch.skills.find(s => s.name === g.skill)?.xp.set(g.toXp);
						}
						void ch.persistSkills();

						// mirror the authoritative server score into the local DB so it
						// shows up in local history / leaderboards (keyed by its onlineId)
						const score = Score.fromDTO(result.score);
						void score.add()
							.then(saved => SceneManager.set(SCENE.RESULT, saved, game, result.gains, false))
							.catch(e => {
								console.warn('[score] local mirror failed', e);
								SceneManager.set(SCENE.RESULT, score, game, result.gains, false);
							});
						return;
					} catch (e) {
						// 404: the result is gone (finalised then TTL-expired, or a long
						// AFK at the end of the play) - fall back to the in-memory replay.
						if (e instanceof PlayResultError && e.status === 404) {
							showLocal();
							return;
						}
						// otherwise it may not be finalised yet (clock skew) - retry, then
						// fall back to the in-memory replay rather than leaving the player stuck.
						if (tries >= 8) {
							console.warn('[score] result fetch failed, showing local replay', e);
							showLocal();
							return;
						}
						await sleep(Math.min(8, Math.pow(2, tries)) * 1000);
						await handleRanked(tries + 1);
					}
				};

				await handleRanked();
				return;
			}

			// guest / unranked: a failed play isn't saved and awards no XP
			if (failed) {
				SceneManager.set(SCENE.RESULT, local, game, undefined, true);
				return;
			}
			void local.add()
				.then(saved => {
					// only guest play awards local XP; unranked play does not
					let progression;
					if (play.mode === 'guest' && botRef.current instanceof CharacterBot) {
						progression = botRef.current.applyProgression(
							beatmapInfo.metadata.total_length, 
							saved,
						);
						void Entities.character.get().persistSkills();
					}
					SceneManager.set(SCENE.RESULT, saved, game, progression, false);
				})
				.catch((e) => { console.warn('[score] save failed', e); onExit(); });
		});
	}, [done]);

	// Watch for a remote abort (another tab/device quitting this play). Only
	// meaningful while the play is still live: once we're past its end the record
	// is gone because the server finalised it (the sweep), not because it was
	// aborted - polling then would misread the finished play as aborted and eject
	// us to song select instead of letting us reach our own result.
	useEffect(() => {
		if (play.mode !== 'ranked') return;

		const watch = setInterval(async () => {
			if (savedRef.current || Date.now() > play.endsAt) return;
			const state = await playSessionHeartbeat(play.token);
			if (state && 'aborted' in state) {
				clearInterval(watch);
				onExit();
			}
		}, 2500);
		return () => clearInterval(watch);
	}, []);

	// Stream the rest of the replay in. The server only revealed the first few
	// seconds at start (anti-cheat: the client must not know the outcome up front),
	// so keep pulling the next slices and fold them into the live play until every
	// offset has arrived.
	useEffect(() => {
		if (play.mode !== 'ranked' || play.done) return;
		const bot = botRef.current;
		if (!(bot instanceof ReplayBot)) return;

		let alive = true;
		let cursor = play.next;
		void (async () => {
			while (alive) {
				try {
					const chunk = await fetchPlayOffsets(play.token, cursor);
					if (!alive) return;
					if (chunk.offsets.length) {
						gameRef.current?.appendReplay(bot.addOffsets(chunk.offsets));
					}
					cursor = chunk.next;
					if (chunk.done) return;
				} catch (e) {
					console.warn('[play] offset stream failed', e);
				}
				await sleep(STREAM_POLL_MS);
			}
		})();
		return () => { alive = false; };
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
		const fieldWidth = keys * COLUMN_WIDTH;
		const mobile = window.innerWidth < 850;

		let w = 0;
		let h = 0;
		let lineY = 0;
		let pxPerUnit = 1;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);

		const resize = () => {
			w = window.innerWidth;
			h = window.innerHeight;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			lineY = h - JUDGE_LINE_FROM_BOTTOM;
			pxPerUnit = lineY / scrollMsRef.current;
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
				// Anchor a ranked play's clock to the server's start time so every tab
				// (the originator and any spectators) shows the exact same position:
				// songPos = (now - startedAt) - lead-in. Computed HERE, not earlier -
				// the decode above can take a while, and a stale anchor is what desyncs.
				if (play.mode === 'ranked') {
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

		const noteY = (time: number, now: number) =>
			lineY 
			- (game.scroll.positionAt(time) 
			- game.scroll.positionAt(now)) * pxPerUnit
		;

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

		// playfield backdrop + column separators
		const drawPlayfield = (x0: number) => {
			ctx.fillStyle = 'rgba(0,0,0,0.55)';
			ctx.fillRect(x0, 0, fieldWidth, h);
			ctx.strokeStyle = 'rgba(255,255,255,0.06)';
			ctx.lineWidth = 1;
			for (let c = 0; c <= keys; c++) {
				ctx.beginPath();
				ctx.moveTo(x0 + c * COLUMN_WIDTH + 0.5, 0);
				ctx.lineTo(x0 + c * COLUMN_WIDTH + 0.5, h);
				ctx.stroke();
			}
		};

		const drawBarlines = (x0: number, now: number) => {
			ctx.strokeStyle = 'rgba(255,255,255,0.16)';
			for (const bl of game.barlines) {
				const y = noteY(bl.time, now);
				if (y < -2 || y > h + 2) continue;
				ctx.beginPath();
				ctx.moveTo(x0, y);
				ctx.lineTo(x0 + fieldWidth, y);
				ctx.stroke();
			}
		};

		type RenderNote = ManiaGame['notes'][number];

		const drawHoldNote = (
			note: RenderNote, 
			cx: number, 
			color: Color, 
			now: number,
		) => {
			if (note.tailJudged) {
				const broke = note.tailMissedAt;
				if (broke !== undefined) {
					// a dropped hold (tail miss - fumble or released way too soon): the
					// body remaining past the break point stays on screen, dimmed, and
					// scrolls off instead of vanishing instantly
					if (broke >= note.endTime) return;
					const yFrom = noteY(broke, now);
					const yTail = noteY(note.endTime, now);
					const top = Math.min(yFrom, yTail);
					const bottom = Math.max(yFrom, yTail);
					if (bottom < -2 || top > h + 2) return;
					ctx.globalAlpha = 0.3;
					ctx.fillStyle = colorA(color, 0.5);
					ctx.fillRect(cx + 6, top, COLUMN_WIDTH - 12, bottom - top);
					ctx.fillStyle = color;
					ctx.fillRect(cx + 4, yTail - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT);
					ctx.globalAlpha = 1;
					return;
				}
				// released cleanly but a touch early: keep drawing as if still held
				// (head pinned to the line) until the tail reaches the line - the
				// hold finishes its travel normally, no pop, no dimming
				if (now >= note.endTime) return;
				const yTail = noteY(note.endTime, now);
				ctx.fillStyle = colorA(color, 0.85);
				ctx.fillRect(
					cx + 6, 
					Math.min(lineY, yTail), 
					COLUMN_WIDTH - 12, 
					Math.abs(lineY - yTail),
				);
				ctx.fillStyle = color;
				ctx.fillRect(cx + 4, yTail - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT);
				ctx.fillRect(cx + 4, lineY - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT);
				return;
			}
			const yHead = note.holding ? lineY : noteY(note.time, now);
			const yTail = noteY(note.endTime, now);
			const top = Math.min(yHead, yTail);
			const bottom = Math.max(yHead, yTail);
			if (bottom < -2 || top > h + 2) return;
			// body
			ctx.fillStyle = note.holding ? colorA(color, 0.85) : colorA(color, 0.5);
			ctx.fillRect(cx + 6, top, COLUMN_WIDTH - 12, bottom - top);
			// tail cap
			ctx.fillStyle = color;
			ctx.fillRect(cx + 4, yTail - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT);
			// head cap - pinned to the receptor while held (the base stays visible),
			// otherwise tracking the head itself: approaching before the hit, and
			// scrolling on past the receptors once it's been missed (an unpressed note)
			ctx.fillRect(cx + 4, yHead - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT);
		};

		const drawTapNote = (
			note: RenderNote, 
			cx: number,
			color: string, 
			now: number,
		) => {
			if (note.headJudged) return;
			const y = noteY(note.time, now);
			if (y < -NOTE_HEIGHT || y > h + NOTE_HEIGHT) return;
			ctx.fillStyle = color;
			roundRect(ctx, cx + 4, y - NOTE_HEIGHT, COLUMN_WIDTH - 8, NOTE_HEIGHT, 4);
			ctx.fill();

			if (debug) {
				ctx.font = '700 10px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillStyle = 'black';
				ctx.fillText(`1/${note.snap}`, cx + 4 + (COLUMN_WIDTH - 8) / 2, y);
				ctx.fillText(
					Reading.countTransitions(
						new Map(), 
						game.visibleNotesAt(note.time),
					).toString(), 
					cx + 4 + (COLUMN_WIDTH - 8) / 2,
					y + 9,
				);
			}
		};

		const drawNotes = (x0: number, now: number) => {
			for (const note of game.notes) {
				const cx = x0 + note.column * COLUMN_WIDTH;
				const color = skin.data.hitObjects[note.column].color;
				if (note.hold) drawHoldNote(note, cx, color, now);
				else drawTapNote(note, cx, color, now);
			}
		};

		const drawReceptors = (x0: number, now: number) => {
			for (let c = 0; c < keys; c++) {
				const cx = x0 + c * COLUMN_WIDTH;
				const glow = Math.max(0, 1 - (now - game.columnFlash[c]) / 140);
				ctx.strokeStyle = 'rgba(255,255,255,0.4)';
				ctx.lineWidth = 2;
				ctx.strokeRect(
					cx + 4, 
					lineY - RECEPTOR_HEIGHT, 
					COLUMN_WIDTH - 8, 
					RECEPTOR_HEIGHT,
				);
				if (glow > 0) {
					ctx.fillStyle = colorA(skin.data.hitObjects[c].color, 0.35 * glow);
					ctx.fillRect(
						cx + 4, 
						lineY - RECEPTOR_HEIGHT, 
						COLUMN_WIDTH - 8, 
						RECEPTOR_HEIGHT,
					);
				}
			}
			// judgement line
			// ctx.strokeStyle = 'rgba(255,255,255,0.85)';
			// ctx.lineWidth = 3;
			// ctx.beginPath();
			// ctx.moveTo(x0, lineY);
			// ctx.lineTo(x0 + fieldWidth, lineY);
			// ctx.stroke();
		};

		// strain meters (left side): one stress gauge per skill, 0-100%. Narrow
		// screens drop the bars and show just the %, tinted the gauge's colour.
		const drawStrainMeters = (now: number) => {
			if (strainBotRef.current) {
				const compact = w < 700;
				const strains = strainBotRef.current.strainsAt(now);
				const bx = 16;
				const bw = 150;
				const step = compact ? 30 : 26;
				const by0 = Math.max(150, h * 0.24);
				ctx.font = '600 11px "Exo 2", sans-serif';
				STRAIN_HUD_SKILLS.forEach((skill, i) => {
					// ease toward the live value so per-note jumps read as motion
					const added = (strains[skill] - strainDisplay.current[skill]) * 0.2;
					const v = strainDisplay.current[skill] += added;
					const by = by0 + i * step;
					// calm green → stressed red
					const color = `hsl(${120 - v * 120}, 85%, 55%)`;
					ctx.textAlign = 'left';
					ctx.fillStyle = 'rgba(255,255,255,0.75)';
					ctx.fillText(skillLabels[skill], bx, by);
					if (compact) {
						ctx.fillStyle = color;
						ctx.fillText(`${Math.round(v * 100)}%`, bx, by + 13);
						return;
					}
					ctx.textAlign = 'right';
					ctx.fillText(`${Math.round(v * 100)}%`, bx + bw, by);
					ctx.fillStyle = 'rgba(255,255,255,0.12)';
					roundRect(ctx, bx, by + 5, bw, 8, 4);
					ctx.fill();
					if (v > 0.005) {
						ctx.fillStyle = color;
						roundRect(ctx, bx, by + 5, Math.max(8, bw * v), 8, 4);
						ctx.fill();
					}
				});
			}
		};

		// eased HP fraction for the bar, carried between frames so drains/heals glide
		// instead of snapping (the canvas bar has no CSS transition to lean on)
		let hpEased = game.score.hp / MAX_HP;
		let hpLast = performance.now();

		const drawHud = (x0: number, now: number) => {
			const cxField = x0 + fieldWidth / 2;

			// judgement popup
			const flash = game.lastFlash;
			if (flash) {
				const age = now - flash.time;
				if (age >= 0 && age < 400) {
					ctx.globalAlpha = 1 - age / 400;
					ctx.fillStyle = skin.data.judgements[flash.judgement].judge;
					ctx.font = '700 26px "Exo 2", sans-serif';
					ctx.textAlign = 'center';
					ctx.fillText(skin.data.judgements[flash.judgement].text, cxField, lineY - 90);
					ctx.globalAlpha = 1;
				}
			}
			// combo
			if (game.score.combo > 1) {
				ctx.fillStyle = '#fff';
				ctx.font = '800 44px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(`${game.score.combo}x`, cxField, h * 0.42);
			}
			// NPS
			if (debug) {
				ctx.fillStyle = '#fff';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText(`${game.npsAt(now)}nps`, cxField, h * 0.32);
				ctx.fillText(`${game.visibleNotesAt(now).length}v`, cxField, h * 0.28);
				ctx.fillText(`${Reading.countTransitions(
					new Map(), 
					game.visibleNotesAt(now))}t`,
				cxField,
				h * 0.36,
				);
				ctx.fillText(
					`${num(Speed.weightedGroups(
						new Map(), 
						game.recentNotes(now),
					), 2)}g`,
					cxField, 
					h * 0.39,
				);
				ctx.textAlign = 'left';
				ctx.fillText(
					`x${Math.round(game.scroll.getSpeedAt(now) * 100) / 100}`, 
					15, 
					h * 0.1,
				);
			}

			drawStrainMeters(now);

			if (now < (game.songStartMs - 2000) && game.songStartMs > 5000) {
				ctx.fillStyle = '#fff';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('SKIP', cxField, h * 0.62);
				ctx.fillText('>>>>', cxField, h * 0.64);
			}

			if (play.mode === 'guest') {
				ctx.fillStyle = '#ffffff';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('Offline play', cxField, h * 0.66);
			}

			if (play.mode === 'unranked') {
				ctx.fillStyle = '#bb2727';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('Unranked', cxField, h * 0.66);
			}

			if (play.mode === 'debug') {
				ctx.fillStyle = '#63b3ff';
				ctx.font = '800 23px "Exo 2", sans-serif';
				ctx.textAlign = 'center';
				ctx.fillText('Debug bot - no fail', cxField, h * 0.66);
			}
			// current grade badge (DOM <img>, top right)
			if (game.score.grade !== gradeRef.current) {
				gradeRef.current = game.score.grade;
				setGrade(game.score.grade);
			}
			// accuracy + score (top right)
			ctx.fillStyle = '#fff';
			ctx.textAlign = 'right';
			ctx.font = '700 30px "Exo 2", sans-serif';
			ctx.fillText(
				`${(game.score.accuracy * 100).toFixed(2)}%`,
				w - 28,
				mobile? 90 : 48,
			);
			ctx.font = '500 18px "Exo 2", sans-serif';
			ctx.fillStyle = 'rgba(255,255,255,0.75)';
			ctx.fillText(
				Math.round(game.score.score).toLocaleString(),
				w - 28, 
				mobile? 120 : 76,
			);

			// progress bar
			const prog = Math.max(0, Math.min(1, now / game.songEndMs));
			ctx.fillStyle = 'rgba(255,255,255,0.12)';
			ctx.fillRect(0, 0, w, 4);
			ctx.fillStyle = '#ff66ab';
			ctx.fillRect(0, 0, w * prog, 4);

			// HP bar (right of the playfield) - eased toward the live value, drawn
			// before the hit-error bar so that bar stays on top of it
			const tNow = performance.now();
			const transition = (1 - Math.exp(-(tNow - hpLast) / skin.data.hpBar.transitionMs));
			hpEased += (game.score.hp / MAX_HP - hpEased) * transition;
			hpLast = tNow;
			drawHpBar(skin, ctx, { 
				hp: hpEased, 
				x: x0 + fieldWidth + skin.data.hpBar.gap, 
				bottom: h - skin.data.hpBar.fromBottom, 
			});

			// hit-error bar (below the receptors)
			drawHitErrorBar(skin, ctx, {
				windows: game.windows,
				hits: game.hits,
				now,
				cx: cxField,
				y: lineY + 78,
				halfWidth: Math.min(170, fieldWidth / 2),
			});
		};

		const draw = () => {
			const now = finished ? outroFrom + (performance.now() - outroAt) : songTime();
			nowRef.current = now;
			// pick up a live scroll-speed change (visual only - lineY set on resize)
			pxPerUnit = lineY / scrollMsRef.current;
			game.update(Math.max(0, now));
			queueHitsounds();

			const x0 = fieldX();

			drawBackground();
			syncVideo(now);
			drawPlayfield(x0);
			drawBarlines(x0, now);
			drawNotes(x0, now);
			drawReceptors(x0, now);
			drawHud(x0, now);

			// end of map
			if (!finished 
				&& (game.finished 
					|| (now > game.songEndMs && (play.mode !== 'ranked' || (now > play.endsAt)))
				)
			) {
				finished = true;
				// hand the outro clock the live song position so the playfield keeps
				// scrolling seamlessly while the result screen loads
				outroFrom = now;
				outroAt = performance.now();
				// a fail stops gameplay before the map ends; silence the hitsounds
				// already queued ahead on the audio clock so they don't play on past it
				if (game.score.failed) stopScheduledHitsounds();
				// release the gameplay buffer and hand audio back to the streaming player
				releaseAudio();
				setDone(true);
			}

			// the playfield is now painted (frozen at the lead-in start). On a genuine
			// first launch - not an HMR resume, where the clock is already running -
			// fade the cover out, then release the clock so gameplay begins on a fully
			// revealed playfield rather than behind the cover. A ranked play reveals
			// itself once its clock is anchored to startedAt (see prepareGameplay), so
			// skip it here.
			if (firstFrame) {
				firstFrame = false;
				if (clock.paused && play.mode !== 'ranked') {
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

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onQuit();
		};
		window.addEventListener('keydown', onKey);

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
			window.removeEventListener('keydown', onKey);
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
			<button className="play__back" onClick={onQuit}>
				<span className="game__back-arrow">‹</span> <Trans>quit</Trans>
			</button>
			<div className="play__title">
				{beatmap.metadata.artist} - {beatmap.metadata.title}
				<span>[{beatmap.metadata.version}]</span>
			</div>

			{autopilot && (
				<div className="play__autopilot">
					<div className="play__autopilot-next">
						<Trans>Next up:</Trans> {nextUp
							? <>
								{nextUp.set.metadata.artist} - {nextUp.set.metadata.title}
								<span>[{nextUp.metadata.version}]</span>
							</>
							: '-'}
					</div>
					{online && (
						<div className="play__autopilot-fatigue">
							<Trans>Current Fatigue</Trans>: {accuracy(online.fatiguePercent)}
						</div>
					)}
				</div>
			)}

			{debug && !done && (
				<button className="play__skip" onClick={skipToEnd}>
					skip to end ⏭
				</button>
			)}
		</div>
	);
}

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

		// show interactive content over the fully-covered screen and await a choice
		const dialog = <T,>(
			render: (resolve: (v: T) => void) => ReactNode,
		): Promise<T> =>
			transition.covered.then(() => new Promise<T>(resolve => 
				transition.setContent(render(resolve)),
			));

		// swap back to song select behind the cover, then fade it out to reveal it
		const backToSelect = async () => {
			SceneManager.set(SCENE.SELECT);
			await transition.reveal();
		};

		const fail = async (message: string) => {
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
				setBoot({
					beatmap: live, play: { mode: 'debug' }, timesPlayed: 0, 
				});
				return;
			}

			// commit to a character before scoring - a play resolved mid-validation must
			// not be mis-scored. During server downtime this waits rather than guessing.
			await Account.ready();
			const character = Entities.character.get();
			const session = await startPlaySession(
				character, 
				live.metadata.beatmapId, 
				live.metadata.beatmapSetId,
			);

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
					await backToSelect();
					return;
				}
				play = { mode: 'unranked' };
			} else {
				play = session;
			}

			const timesPlayed = await Score.countPlays(
				character.id, 
				live.metadata.beatmapId,
			);
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

// ---- tiny canvas helpers ----
function roundRect(
	ctx: CanvasRenderingContext2D, 
	x: number, 
	y: number,
	w: number, 
	h: number, 
	r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}