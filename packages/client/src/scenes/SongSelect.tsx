import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Trans, Plural, useLingui } from '@lingui/react/macro';
import Triangles from '../components/Triangles';
import BeatmapCarousel, {
	type CarouselItem,
	type CarouselRow,
	type DownloadState,
} from '../components/BeatmapCarousel';
import { groupsOf, EMPTY_HISTORY, EMPTY_PLAYLISTS, type Group } from '../osu/beatmap/grouping';
import Leaderboard from '../components/leaderboard/Leaderboard';
import Dropdown from '../components/dropdown/Dropdown';
import StrainDebug from './StrainDebug';
import { matchesSearch } from '../osu/beatmap/beatmapSearch';
import Entities from '../entity/entities';
import Auth from '../online/auth';
import { music, PLAYER_MODE } from '../audio/MusicPlayer';
import BeatmapAPI, { Metadata } from '../osu/beatmap/beatmap_api';
import LightBeatmapSet from '../osu/beatmap/LightBeatmapSet';
import LightBeatmap from '../osu/beatmap/LightBeatmap';
import Background from './Background';
import './SongSelect.css';
import BeatmapStore, { beatmapsVersion } from '../osu/beatmap/beatmap_store';
import Controls from '../input/Controls';
import SceneManager, { SCENE } from './SceneManager';
import { debugMode, isWebOpen, webUrl } from '../globals';
import { useParallax } from '@osu-idle/shared/hooks/useParallax';
import useSynced from '@osu-idle/shared/hooks/useSynced';
import useAsync from '@osu-idle/shared/hooks/useAsync';
import { getCharacter, getCharacterStats } from '../online/services/characters';
import num, { bpm } from '@osu-idle/shared/display/num';
import accuracy from '@osu-idle/shared/display/accuracy';
import hitAccuracy from '@osu-idle/shared/osu/hitAccuracy';
import { xpForLevel } from '@osu-idle/shared/sim/skills/xp';
import { length } from '@osu-idle/shared/display/length';
import { Grades } from '@osu-idle/shared/judgement';
import { Score } from '../db/schema/score';
import { GroupOption, GroupOptions, SETTINGS, SortOption, SortOptions } from '../db/settings';
import Character from '../db/schema/character';
import { recentTimeAgo } from '@osu-idle/shared/display/ago';
import { getPlaylistIndex, playlistsVersion } from '../db/schema/playlist';
import ContextMenu from '../components/ContextMenu';
import PlaylistOverlay from '../components/PlaylistOverlay';
import Autopilot, { AUTOPILOT_MODE } from '../gameplay/autopilot';
import { launchPlay } from './launchPlay';

/** Dev-only: the diff id the strain debug overlay is open on, stashed in
 *  sessionStorage so a full dev-server reload (a skill edit forces one) reopens
 *  it instead of dropping back to the intro. See SceneManager's boot. */
export const STRAIN_DEBUG_KEY = 'strain-debug-diff';

/** Player-facing label for a sort/group option. The option *value* stays the
 *  raw key - comparators, the persisted setting, and grouping all branch on it -
 *  so only this display text is translated. GroupOption is the superset, so one
 *  mapping covers both dropdowns. */
function optionLabel(option: GroupOption | SortOption): ReactNode {
	switch (option) {
		case 'No Grouping': return <Trans>No Grouping</Trans>;
		case 'By Artist': return <Trans>By Artist</Trans>;
		case 'By BPM': return <Trans>By BPM</Trans>;
		case 'By Creator': return <Trans>By Creator</Trans>;
		case 'By Difficulty': return <Trans>By Difficulty</Trans>;
		case 'By Length': return <Trans>By Length</Trans>;
		case 'By Playlist': return <Trans>By Playlist</Trans>;
		case 'By Rank Achieved': return <Trans>By Rank Achieved</Trans>;
		case 'By Title': return <Trans>By Title</Trans>;
		case 'Recently Played': return <Trans>Recently Played</Trans>;
	}
}

export const GROUP_OPTIONS = GroupOptions.map((v) => ({ value: v, label: optionLabel(v) }));
export const SORT_OPTIONS = SortOptions.map((v) => ({ value: v, label: optionLabel(v) }));

const getHistory = async (character: Character) => {
	const scores = await Score.query('SELECT * FROM score WHERE characterId = ?', [character.id]);
	const bestRank = new Map<number, number>();   // beatmapId -> best Grades index (lower = better)
	const lastPlayed = new Map<number, number>(); // beatmapId -> most recent playedAt
	for (const s of scores) {
		bestRank.set(s.beatmapId, Math.min(bestRank.get(s.beatmapId) ?? Infinity, Grades.indexOf(s.grade)));
		lastPlayed.set(s.beatmapId, Math.max(lastPlayed.get(s.beatmapId) ?? 0, s.playedAt));
	}
	return { bestRank, lastPlayed };
};
type History = Awaited<ReturnType<typeof getHistory>>;

/** Carousel comparators per sort option. Ties keep the prior (difficulty)
 *  order - Array.sort is stable and `items` loads difficulty-sorted. Options
 *  missing here (Rank Achieved, Recently Played) need play history we don't have
 *  in the carousel yet, so they leave the order untouched. */
const SORT_COMPARATORS: Record<SortOption, (a: CarouselItem, b: CarouselItem, h: History) => number> = {
	'By Artist': (a, b) => a.set.metadata.artist.localeCompare(b.set.metadata.artist),
	'By BPM': (a, b) => a.beatmap.metadata.bpm - b.beatmap.metadata.bpm,
	'By Creator': (a, b) => a.set.metadata.creator.localeCompare(b.set.metadata.creator),
	'By Difficulty': (a, b) => a.beatmap.metadata.difficulty - b.beatmap.metadata.difficulty,
	'By Length': (a, b) => a.beatmap.metadata.total_length - b.beatmap.metadata.total_length,
	'By Title': (a, b) => a.set.metadata.title.localeCompare(b.set.metadata.title),
	"By Rank Achieved": (a, b, h) => (h.bestRank.get(b.beatmap.metadata.id) ?? Infinity) - (h.bestRank.get(a.beatmap.metadata.id) ?? Infinity),
	"Recently Played": (a, b, h) => (h.lastPlayed.get(b.beatmap.metadata.id) ?? 0) - (h.lastPlayed.get(a.beatmap.metadata.id) ?? 0)
};

/**
 * The game interface: an osu!-style song-select screen. The carousel on the
 * right lists every playable difficulty sorted by star rating; the leaderboard
 * on the left shows scores for the selected difficulty. Single-click a card to
 * select (and preview), click an already-selected (downloaded) card to play, and
 * double-click a remote card to download it.
 */
export default function SongSelect() {
	music.mode.set(PLAYER_MODE.LOOP);
	
	if (!music.playing.get()) {
		music.play(0);
	}

	// the right-click contextual menu's target, and the playlist manager's target
	const [menuItem, setMenuItem] = useState<CarouselItem | null>(null);
	const [playlistItem, setPlaylistItem] = useState<CarouselItem | null>(null);
	// delete needs a second click to confirm (osu!-style); reset whenever the menu closes
	const [deleteArmed, setDeleteArmed] = useState(false);
	useEffect(() => { if (!menuItem) setDeleteArmed(false); }, [menuItem]);

	// landing back on song select is how every playlist-autopilot run ends
	// (quitting gameplay, backing out of the result, a failed launch) - stop any
	// session here so a stale one can never chain plays later.
	useEffect(() => { Autopilot.stop(); }, []);

	const onBack = () => {
		if (playlistItem) { setPlaylistItem(null); return; }
		if (menuItem) { setMenuItem(null); return; }
		SETTINGS.search.set('');
		SceneManager.set(SCENE.MENU);
	};

	Controls.back.usePress(onBack);

	const [parallaxOn] = useSynced(SETTINGS.parallax);
	const parallax = useParallax(0.12, parallaxOn);
	const [scrollSpeed] = useSynced(SETTINGS.scrollspeed);
	const [library] = useSynced(beatmapsVersion);
	const [character] = useSynced(Entities.character);
	const online_character = useAsync(async () => character.id > 1 ? getCharacter(character.id) : undefined, [character]);
	const online_stats = useAsync(async () => character.id > 1 ? getCharacterStats(character.id) : undefined, [character]);
	const nextGlobal = online_character ? xpForLevel(online_character.overallLevel) : undefined;
	const [user] = useSynced(Auth.user);
	const [debug] = useSynced(debugMode);
	const { t } = useLingui(); // for strings outside JSX text (attrs, toasts, menu)

	const [items, setItems] = useState<CarouselItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [version] = useSynced(music.beatmap);
	const [downloads, setDownloads] = useState<Record<number, DownloadState>>({});
	const [hasDownloaded, setHasDownloaded] = useState(false);
	const [toast, setToast] = useState<string | null>(null);
	const toastTimer = useRef<number>(0);
	const [debugBeatmap, setDebugBeatmap] = useState<LightBeatmap>();
	const [search] = useSynced(SETTINGS.search);
	const searchRef = useRef<HTMLInputElement>(null);
	const [scoreView, setScoreView] = useState(false);

	/** (Re)load the whole library from the manifest, returning the sorted items. */
	const loadLibrary = useCallback(async (): Promise<CarouselItem[]> => {
		try {
			const manifest = await BeatmapAPI.getManifest();
			const runtime = await BeatmapStore.getAllSets();
			const remoteMaps = await Promise.all(manifest.beatmaps.flatMap(m => LightBeatmapSet.fromMetadata(m).getCarouselItems()));
			const localMaps = runtime.flatMap(r => r.getCarouselItems());
			setHasDownloaded(localMaps.length > 0);
			const sets = new Map<number, CarouselItem>();
			remoteMaps.forEach(m => sets.set(m.beatmap.metadata.id, m));
			localMaps.forEach(m => sets.set(m.beatmap.metadata.id, m));
			const all = Array.from(sets.values()).sort((a, b) => a.beatmap.metadata.difficulty - b.beatmap.metadata.difficulty);
			setItems(all);
			// reconcile downloaded status (drives card styling) against what's actually
			// stored: mark stored sets 'done', and drop a stale 'done' for any set no
			// longer present (e.g. just deleted) so its card restyles back to remote.
			// In-flight 'downloading' entries are left untouched.
			const stored = new Set(all.filter(i => i.beatmap.metadata.runtime).map(i => i.set.metadata.id));
			setDownloads((d) => {
				const next = { ...d };
				for (const id of stored) {
					if (next[id]?.status !== 'done') next[id] = { status: 'done', progress: 1 };
				}
				for (const key of Object.keys(next)) {
					const id = Number(key);
					if (next[id].status === 'done' && !stored.has(id)) delete next[id];
				}
				return next;
			});
			return all;
		} catch (e) {
			setError(String(e));
			return [];
		} finally {
			setLoading(false);
		}
	}, []);

	// `library` bumps when the stored set changes (e.g. a wipe from Options), so
	// the carousel reflects deletions without a full reload.
	useEffect(() => { void loadLibrary(); }, [loadLibrary, library]);

	// osu!-style "type anywhere to search": a printable key focuses the box (and
	// flows into it), Escape clears it
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = searchRef.current;
			if (!el) return;
			// an open overlay (context menu / playlist manager) owns the keyboard:
			// Escape closes it via onBack, and typing must not steal focus from it
			if (menuItem || playlistItem) return;
			if (e.key === 'Escape') {
				if (document.activeElement === el || search) {
					SETTINGS.search.set('');
					el.blur();
					e.preventDefault();
				}
				return;
			}
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;
			if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) el.focus();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [search, menuItem, playlistItem]);

	const [sort] = useSynced(SETTINGS.sortby);
	const [group] = useSynced(SETTINGS.groupby);

	// local playlists, re-read on every mutation: which playlists each difficulty
	// belongs to drives the "By Playlist" group mode.
	const [plVersion] = useSynced(playlistsVersion);
	const playlistIndex = useAsync(() => getPlaylistIndex(), [plVersion]);
	const playlistsByBeatmap = playlistIndex?.byBeatmap ?? EMPTY_PLAYLISTS;

	const comparator = SORT_COMPARATORS[sort];

	// per-beatmap play history for the active character, backing the two
	// history-based sorts. A score's `beatmapId` matches `beatmap.metadata.id`
	// (the same key the leaderboard queries by).
	const history = useAsync(() => getHistory(character), [character]);

	// the carousel shows the search-filtered, sort-ordered subset; selection logic
	// keeps using the full `items` so a search never loses the current selection
	const filteredItems = useMemo(() => {
		if (!history) return [];
		const filtered = search.trim() ? items.filter(({ beatmap, set }) => matchesSearch(beatmap, set, search)) : items;
		return comparator ? [...filtered].sort((a, b) => comparator(a, b, history)) : filtered;
	}, [items, search, history, comparator]);

	// accordion: at most one group open at a time (null = all collapsed). A fresh
	// group mode resets it; the active group then re-opens via the effect below.
	const [expandedKey, setExpandedKey] = useState<string | null>(null);
	useEffect(() => { setExpandedKey(null); }, [group]);

	// opening a group closes the previously open one; clicking the open one collapses it
	const toggleGroup = useCallback((key: string) => {
		setExpandedKey((prev) => (prev === key ? null : key));
	}, []);

	// the group(s) holding the current selection - plural, because a difficulty
	// can sit in several playlists at once. Joined into one string so the effect
	// below re-runs only on a genuine membership change, not on every recompute.
	const activeGroupKeys = useMemo(() => {
		if (group === 'No Grouping' || !version) return '';
		const item = items.find((i) => i.beatmap.is(version));
		if (!item) return '';
		return groupsOf(item, group, history ?? EMPTY_HISTORY, Date.now(), playlistsByBeatmap)
			.map((g) => g.key).join('\n');
	}, [group, version, items, history, playlistsByBeatmap]);

	// the selection's group opens automatically when the selection moves into it
	// (closing any other) - but stays collapsible by hand, since we only re-open on
	// a genuine change of active groups, not on every render. When the selection
	// sits in several groups, one already open wins; otherwise the first opens.
	useEffect(() => {
		const keys = activeGroupKeys ? activeGroupKeys.split('\n') : [];
		if (keys.length === 0) return;
		setExpandedKey((prev) => (prev && keys.includes(prev) ? prev : keys[0]));
	}, [activeGroupKeys]);

	// fold the sorted, filtered list into grouped carousel rows. `orderedItems`
	// is every card in display order (ignoring collapse) so arrow-key navigation
	// can step into a collapsed group, which then auto-opens as it becomes active.
	// An item can land in several buckets (playlists); only one group is ever
	// open (accordion), so duplicate cards never render together. `expanded` is
	// the open group's bucket - the playlist autopilot launches from it.
	const { rows, orderedItems, expanded } = useMemo(() => {
		if (group === 'No Grouping') {
			return {
				rows: filteredItems.map((item): CarouselRow => ({ type: 'card', item })),
				orderedItems: filteredItems,
				expanded: undefined,
			};
		}
		const hist = history ?? EMPTY_HISTORY;
		const now = Date.now();
		const buckets = new Map<string, { group: Group; items: CarouselItem[] }>();
		for (const item of filteredItems) {
			for (const g of groupsOf(item, group, hist, now, playlistsByBeatmap)) {
				let bucket = buckets.get(g.key);
				if (!bucket) buckets.set(g.key, bucket = { group: g, items: [] });
				bucket.items.push(item);
			}
		}
		const ordered = [...buckets.values()].sort(
			(a, b) => a.group.order - b.group.order || a.group.label.localeCompare(b.group.label),
		);
		const rows: CarouselRow[] = [];
		const orderedItems: CarouselItem[] = [];
		for (const { group: g, items: its } of ordered) {
			const open = expandedKey === g.key;
			rows.push({ type: 'header', key: g.key, label: g.label, count: its.length, collapsed: !open });
			for (const item of its) {
				orderedItems.push(item);
				if (open) rows.push({ type: 'card', item });
			}
		}
		return { rows, orderedItems, expanded: expandedKey ? buckets.get(expandedKey) : undefined };
	}, [filteredItems, group, history, expandedKey, playlistsByBeatmap]);

	/**
	 * Select a difficulty: record the global selection (the carousel reacts by
	 * gliding the card to centre) and start its audio - the full song if the set
	 * is downloaded (a parsed Beatmap), otherwise the manifest preview clip (a
	 * VersionMetadata). The MusicPlayer resolves the right source from whichever
	 * it's handed; the backdrop is swapped per-difficulty too.
	 */
	const selectItem = useCallback(async (beatmap: LightBeatmap) => {
		if (beatmap.is(music.beatmap.get())) return;

		console.log('selected', beatmap.metadata.version);
		await music.beatmap.set(beatmap);
		await music.play(beatmap.metadata.runtime ? beatmap.metadata.previewTime : 0);
	}, []);

	// up/down arrows step the selection through the visible carousel (osu!-style),
	// regardless of search-box focus; the carousel glides the new card to centre
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
			if (orderedItems.length === 0) return;
			e.preventDefault();
			const current = orderedItems.findIndex((i) => i.beatmap.is(music.beatmap.get()));
			const step = e.key === 'ArrowDown' ? 1 : -1;
			// when nothing is selected, ArrowDown lands on the first card, ArrowUp the last
			const next = current === -1
				? (step === 1 ? 0 : orderedItems.length - 1)
				: Math.min(Math.max(current + step, 0), orderedItems.length - 1);
			void selectItem(orderedItems[next].beatmap);
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [orderedItems, selectItem]);

	const flashToast = useCallback((msg: string) => {
		setToast(msg);
		window.clearTimeout(toastTimer.current);
		toastTimer.current = window.setTimeout(() => setToast(null), 3500);
	}, []);

	/**
	 * Launch gameplay for a downloaded difficulty (see {@link launchPlay}) and
	 * arm the autopilot per the selected mode (debug launches never chain):
	 *   LOOP     - replay this one map forever
	 *   PLAYLIST - chain the launched playlist group (only when grouped by playlist)
	 *   NEXT     - chain in song-select order: the open group when grouped,
	 *              otherwise the whole search-filtered list
	 */
	const play = useCallback((beatmap: LightBeatmap, debug = false) => {
		if (!debug) {
			const mode = SETTINGS.autopilotMode.get();
			if (mode === AUTOPILOT_MODE.LOOP) {
				Autopilot.start(beatmap.set.metadata.title, [beatmap], 0);
			} else if (mode !== AUTOPILOT_MODE.PLAYLIST || group === 'By Playlist') {
				const pool = expanded ? expanded.items : orderedItems;
				const index = pool.findIndex((i) => i.beatmap.is(beatmap));
				if (index >= 0) Autopilot.start(expanded?.group.label ?? '', pool.map((i) => i.beatmap), index);
			}
		}
		launchPlay(beatmap, debug);
	}, [group, expanded, orderedItems]);

	/** Download a remote set, then upgrade it in place to playable RuntimeBeatmaps. */
	const download = useCallback(async (meta: Metadata) => {
		console.log('Clicked on download', meta.title);
		const status = downloads[meta.id]?.status;
		if (status === 'downloading' || status === 'done') return;
		setDownloads((d) => ({ ...d, [meta.id]: { status: 'downloading', progress: 0 } }));
		try {
			await BeatmapAPI.downloadOsz(meta, (progress) =>
				setDownloads((d) => ({ ...d, [meta.id]: { status: 'downloading', progress } })),
			);
			setDownloads((d) => ({ ...d, [meta.id]: { status: 'done', progress: 1 } }));
			
			const all = await loadLibrary();
			const item = all.find((i) => i.beatmap.isPlaying());
			if (item) void selectItem(item.beatmap);
		} catch (e) {
			console.error('[download] failed', e);
			setDownloads((d) => ({ ...d, [meta.id]: { status: 'idle', progress: 0 } }));
		}
	}, [downloads, loadLibrary, selectItem]);

	// single click: select + preview; clicking the already-selected downloaded card plays it
	const handleCardClick = useCallback((beatmap: LightBeatmap) => {
		if (scoreView) return;
		console.log('Clicked on card', beatmap.metadata.version);
		if (beatmap.metadata.runtime && beatmap.isPlaying()) play(beatmap);
		else void selectItem(beatmap);
	}, [scoreView, play, selectItem]);

	// double click: download the set - but do nothing if it's already downloaded
	const handleCardDoubleClick = useCallback((beatmap: LightBeatmap) => {
		if (scoreView) return;
		const set = beatmap.set;
		if (beatmap.metadata.runtime || set.metadata.runtime) return;
		void download(set.metadata);
	}, [scoreView, download]);

	// right click (no drag): the card's osu!-style contextual menu
	const handleCardRightClick = useCallback((item: CarouselItem) => {
		if (scoreView) return;
		setMenuItem(item);
	}, [scoreView]);

	// delete the menu target's whole set from the local store (mirrors the
	// Options "delete all" wipe, scoped to one set); the version bump reloads the
	// carousel without the deleted cards.
	const deleteSet = useCallback((item: CarouselItem) => {
		setMenuItem(null);
		BeatmapStore.deleteSet(item.set.metadata.id)
			.then(() => flashToast(t`Beatmap deleted`))
			.catch((e) => flashToast(String(e)));
	}, [flashToast, t]);

	const openDebug = useCallback((beatmap: LightBeatmap) => {
		sessionStorage.setItem(STRAIN_DEBUG_KEY, String(beatmap.metadata.id));
		setDebugBeatmap(beatmap);
	}, []);

	const closeDebug = useCallback(() => {
		sessionStorage.removeItem(STRAIN_DEBUG_KEY);
		setDebugBeatmap(undefined);
	}, []);

	// dev-only: open the strain debug overlay for the selected, downloaded diff
	const handleDebug = useCallback(() => {
		const item = items.find((i) => i.beatmap.is(version));
		if (!item) return;
		if (!item.beatmap.metadata.runtime) {
			flashToast(t`Download the beatmap first`);
			return;
		}
		openDebug(item.beatmap);
	}, [version, items, flashToast, openDebug, t]);

	// reopen the strain debug after a full dev-server reload (skill edits force
	// one, which wipes in-memory scene state)
	useEffect(() => {
		if (debugBeatmap || !items.length) return;
		const stored = sessionStorage.getItem(STRAIN_DEBUG_KEY);
		if (!stored) return;
		const item = items.find((i) => i.beatmap.is(Number(stored)));
		if (item?.beatmap.metadata.runtime) setDebugBeatmap(item.beatmap);
	}, [items, debugBeatmap]);

	// pre-formatted metadata + stats, so the <Trans> placeholders read by name
	// (e.g. {totalLength}) in the catalog instead of positional {0}.
	const totalLength = length((version?.metadata.total_length ?? 0) / 1000);
	const bpmText = bpm(version?.metadata.bpm ?? 0);
	const pp = num(online_character?.pp);
	const accText = online_stats && accuracy(hitAccuracy(online_stats));
	const fatigue = online_character ? accuracy(online_character.fatiguePercent) : '';
	const level = num(online_character?.overallLevel);
	const total = items.length; // referenced by name in the plural below

	return (
		<div className={`game ${scoreView ? 'score-view' : ''}`}>
			<Background />
			<div
				className="game__bg"
				style={{ transform: `scale(1.06) translate(${parallax.x * 14}px, ${parallax.y * 14}px)` }}
			>
				<Triangles parallax={parallax} count={40} />
			</div>
			<div className="game__scrim" />

			<header className="game__topbar">
				<svg className="game__topshape" viewBox="0 0 1000 185" preserveAspectRatio="none" aria-hidden>
					<path className="game__topshape-fill" d="M0 0 H1000 V100 H430 C300 100 288 185 270 185 H0 Z" />
					<path className="game__topshape-edge" d="M0 185 H270 C288 185 300 100 430 100 H1000" />
				</svg>
				{version && (<>
					<div className="game__topinfo">
						<div className="game__top_md-container">
							<div className="game__top_md">
								<div className="game__top_md_icon">
									<div style={{ backgroundImage: `url('${version.metadata.runtime ? '/ranked.png' : '/unknown.png' }')`}}></div>
								</div>
								<div className="game__top_md_text">
									<div className="game__top_md_title">
										{version.set.metadata.artist} - {version.set.metadata.title} [{version.metadata.version}]
									</div>
									<div className="game__top_md_creator">
										<Trans>Mapped by {version.set.metadata.creator}</Trans>
									</div>
								</div>
							</div>
							<div className="game__top_version">
								<div className="game__top_music">
									<Trans>Length: {totalLength} BPM: {bpmText} Objects: {version.metadata.objects}</Trans>
								</div>
								<div className="game__top_hos">
									<Trans>Rice: {version.metadata.rice} LN: {version.metadata.ln}</Trans>
								</div>
								<div className="game__top_diff">
									<Trans>Star Rating: {version.metadata.difficulty}★</Trans>
								</div>
							</div>
						</div>
						<div className="game__top_lb-container">
							<button className='mobile__scores' onClick={() => setScoreView(!scoreView)}>{scoreView ? <Trans>Back</Trans> : <Trans>Show scores</Trans>}</button>

							<Leaderboard />
						</div>
					</div>
					<div className="game__topfilter">
						<div className="game__topfilter_scroll">
							{scrollSpeed} (fixed)
						</div>
						<div className="game__topfilter_sort">
							<div className='game__group'>
								<span><Trans>Group</Trans></span>
								<Dropdown value={SETTINGS.groupby} options={GROUP_OPTIONS} accent='#92c3e6' />
							</div>
							<div className='game__sort'>
								<span><Trans>Sort</Trans></span>
								<Dropdown value={SETTINGS.sortby} options={SORT_OPTIONS} accent='#aed28b' />
							</div>
						</div>
					</div>
				</>)}
			</header>

			<main className="game__body">

				{error ? (
					<div className="game__library-error"><Trans>Couldn't load beatmaps: {error}</Trans></div>
				) : (
					<BeatmapCarousel
						rows={rows}
						onCardClick={handleCardClick}
						onCardDoubleClick={handleCardDoubleClick}
						onCardRightClick={handleCardRightClick}
						hasDownloaded={hasDownloaded}
						onToggleGroup={toggleGroup}
						loading={loading}
						downloads={downloads}
						totalCount={filteredItems.length}
					/>
				)}

				<div className="songsearch">
					<div className="songsearch__row">
						<span><Trans>Search:</Trans> </span>
						<input
							ref={searchRef}
							className="songsearch__input"
							value={search}
							onChange={(e) => SETTINGS.search.set(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Tab') e.preventDefault(); }}
							onBlur={() => {
								// keep the box focused (osu!-style), unless another surface
								// legitimately owns the keyboard (debug view, an open overlay)
								if (!debugBeatmap && !menuItem && !playlistItem) {
									requestAnimationFrame(() => searchRef.current?.focus());
								}
							}}
							placeholder={t`Type to search!`}
							spellCheck={false}
							autoComplete="off"
						/>
					</div>
					<div className="songsearch__count">
						{search.trim()
							? <Trans>{filteredItems.length} of {total} results</Trans>
							: <Plural value={items.length} one="# result" other="# results" />}
					</div>
				</div>
			</main>

			<div className="game__botbar">
				<button className="game__exit" onClick={onBack}>
					<Trans>BACK</Trans>
				</button>
				<div
					className="game__user"
					title={t`Open osu! web`}
					onClick={async () => {
						await webUrl.set(character.isGuest() ? 'login' : `c/${character.id}`);
						await isWebOpen.set(true);
					}}
				>
					<div className="game__avatar">
						<img className="game__avatar-img" src={user?.avatarUrl ?? '/web/guest.png'} alt="" />
					</div>
					<div className="game__user-meta">
						<span className="game__user-name">{character.name}</span>
						{online_character && (<>
							<span className="game__user-pp"><Trans>Performance: {pp}pp</Trans></span>
							<span className="game__user-acc"><Trans>Accuracy: {accText}</Trans>
								{online_character.sessionTime > 600000 && <span className='game__user-fatigue'>{recentTimeAgo(online_character.sessionTime)} ({fatigue})</span>}
							</span>
							<span className="game__user-level"><Trans>Lv{level}</Trans></span>
						</>)}
						{!online_character && (
							<span className="game__user-pp"><Trans>Click here to login!</Trans></span>
						)}
						<div className="game__user-level-bar">
							<div
								className="game__user-level-bar-fill"
								style={{ width: `${Math.min(1, (online_character?.overallXp ?? 0) / (nextGlobal || 1)) * 100}%` }}
							/>
						</div>
					</div>
				</div>
			</div>

			{toast && <div className="game__toast">{toast}</div>}

			{debug && (
				<button className="game__debug-btn" onClick={handleDebug} title={t`Strain debug`}>
					⛛
				</button>
			)}

			{debugBeatmap && (
				<StrainDebug beatmapInfo={debugBeatmap} onClose={closeDebug} onPlay={() => play(debugBeatmap, true)} />
			)}

			{menuItem && (
				<ContextMenu
					title={`${menuItem.set.metadata.artist} - ${menuItem.set.metadata.title}`}
					sub={t`What do you want to do with this beatmap?`}
					onClose={() => setMenuItem(null)}
					options={[
						{ label: t`1. Manage Playlists`, color: '#85b81e', onClick: () => { setPlaylistItem(menuItem); setMenuItem(null); } },
						{ label: deleteArmed ? t`2. Click again to delete` : t`2. Delete...`, color: '#e93100', onClick: () => { if (deleteArmed) deleteSet(menuItem); else setDeleteArmed(true); } },
						{ label: t`3. Clear local scores`, color: '#ce7dd6', onClick: () => { setMenuItem(null); flashToast(t`Clearing local scores is not available yet`); } },
						{ label: t`4. Cancel`, color: '#6b6b6b', onClick: () => setMenuItem(null) },
					]}
				/>
			)}

			{playlistItem && (
				<PlaylistOverlay beatmap={playlistItem.beatmap} onClose={() => setPlaylistItem(null)} />
			)}
		</div>
	);
}
