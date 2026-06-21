/* eslint-disable @typescript-eslint/no-explicit-any */
import Synced from '@osu-idle/shared/helpers/synced';
import { type Locale, detectBrowserLocale } from '@osu-idle/shared/i18n/locales';
import { AUTOPILOT_MODE, AutopilotMode } from '../gameplay/autopilot';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';

export const SCORE_TAB = mapped(['LOCAL', 'GLOBAL', 'COUNTRY']);
export type ScoreTab = ValueIn<typeof SCORE_TAB>;

export const GroupOptions = [
	'No Grouping', 'By Artist', 'By BPM', 'By Creator', 'By Difficulty',
	'By Download Status', 'By Length', 'By Playlist', 'By Rank Achieved', 'By Title', 'Recently Played',
] as const;
export const GROUP_OPTION = mapped(GroupOptions);
export type GroupOption = ValueIn<typeof GROUP_OPTION>;

export const SortOptions = [
	'By Artist', 'By BPM', 'By Creator', 'By Difficulty',
	'By Length', 'By Rank Achieved', 'By Title', 'Recently Played',
] as const;
export const SORT_OPTION = mapped(SortOptions);
export type SortOption = ValueIn<typeof SORT_OPTION>;

export class Setting<T, K extends string = string> extends Synced<T> {


	constructor(
		public readonly key: K,
		public readonly defaultValue: T,
	) {
		super(defaultValue);
		this.load();
		this.forceSync(value => this.save(value));
	}

	private load() {
		this.set(JSON.parse(localStorage.getItem(this.key) ?? JSON.stringify(this.defaultValue)));
	}

	private save(value: T) {
		localStorage.setItem(this.key, JSON.stringify(value));
	}

}

export type DefaultSettings = readonly Setting<any, string>[];

const option = <T>() =>
	<K extends string>(key: K, defaultValue: T) => new Setting<T, K>(key, defaultValue);

const defaults = [
	/**
	 * Volume controls
	 */
	option<number>()('mainVolume', 1),
	option<number>()('musicVolume', 0.15),
	option<number>()('effectVolume', 0.15),
	/**
	 * Currently selected song select leaderboard tab
	 */
	option<ScoreTab>()('leaderboard', SCORE_TAB.GLOBAL),
	/**
	 * Song selection group category
	 */
	option<GroupOption>()('groupby', GROUP_OPTION['No Grouping']),
	/**
	 * Song selection sort filter
	 */
	option<SortOption>()('sortby', SORT_OPTION['By Difficulty']),
	/**
	 * Last tutorial step reached; >= the wizard's step count means completed
	 */
	option<number>()('tutorial', 0),
	/**
	 * Last news seen, used in the main menu
	 */
	option<number>()('news', 0),
	/**
	 * The current song select search
	 */
	option<string>()('search', ''),
	/**
	 * Touch long-press duration (ms) before it counts as a right click
	 */
	option<number>()('longpress', 400),
	option<number>()('scrollspeed', 16),
	/**
	 * Active UI language. Defaults to the browser's preferred locale on first
	 * run, then sticks to the player's explicit choice. Read at boot (main.tsx)
	 * and re-activated whenever the picker changes it.
	 */
	option<Locale>()('language', detectBrowserLocale()),
	/**
	 * Graphics toggles. `backgroundDim` is the gameplay background darkening
	 * amount (0 = fully visible, 1 = black).
	 */
	option<boolean>()('showFps', false),
	option<boolean>()('fullscreen', false),
	option<boolean>()('parallax', true),
	option<boolean>()('osuMusicTheme', true),
	option<boolean>()('showThumbnails', true),
	option<number>()('backgroundDim', 0.8),
	option<number>()('autopilotDelay', 30),
	option<AutopilotMode>()('autopilotMode', AUTOPILOT_MODE.PLAYLIST),
] as const satisfies DefaultSettings;

type SettingsByKey<T extends DefaultSettings> = {
	[O in T[number] as O['key']]: O;
};

export const SETTINGS = defaults.reduce((acc, option) => {
	acc[option.key as keyof typeof acc] = option as any;
	return acc;
}, {} as SettingsByKey<typeof defaults>);
