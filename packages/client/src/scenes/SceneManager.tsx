import LightBeatmap from '../osu/beatmap/LightBeatmap';
import IntroScreen from './IntroScreen';
import MainMenu from './MainMenu';
import SongSelect, { STRAIN_DEBUG_KEY } from './SongSelect';
import Gameplay from './Gameplay';
import Addons, { type AddonsView } from './Addons';
import { ManiaGame } from '@osu-idle/shared/sim/maniaGame';
import { Score } from '../db/schema/score';
import Result from './Result';
import type { SkillProgress } from '@osu-idle/shared/sim/bots/character';
import type { Transition } from './Transition';
import { mapped, ValueIn } from '@osu-idle/shared/helpers/mapped';
import Synced from '@osu-idle/shared/helpers/synced';
import { ScoreDTO } from '@osu-idle/shared/score';

export const SCENE = mapped([
	'INTRO',
	'MENU',
	'SELECT',
	'GAME',
	'RESULT',
	'ADDONS',
]);
export type Scene = ValueIn<typeof SCENE>;

const persisted = (import.meta.hot?.data ?? {}) as {
	current?: Synced<Scene>;
	scene?: Synced<JSX.Element>;
	displayAlpha?: Synced<boolean>;
	initialized?: boolean;
};

export default class SceneManager {

	private static get = {
		[SCENE.INTRO]: () => <IntroScreen />,
		[SCENE.MENU]: (flash: boolean = false) => <MainMenu flash={flash} />,
		[SCENE.SELECT]: () =>  <SongSelect />,
		[SCENE.GAME]: (beatmapInfo: LightBeatmap, transition: Transition, debug = false) => <Gameplay beatmapInfo={beatmapInfo} transition={transition} debugPlay={debug} />,
		[SCENE.RESULT]: (score: Score | ScoreDTO, game?: ManiaGame, progression?: SkillProgress[], failed?: boolean) => <Result game={game} score={score} progression={progression} failed={failed} />,
		[SCENE.ADDONS]: (view: AddonsView = 'manage') => <Addons view={view} />,

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as const satisfies Record<Scene, (...args: any[]) => JSX.Element>;

	public static current = (persisted.current ??= new Synced<Scene>(SCENE.INTRO));
	public static scene = (persisted.scene ??= new Synced<JSX.Element>(<></>));
	public static displayAlpha = (persisted.displayAlpha ??= new Synced(false));

	public static set<S extends Scene>(scene: S, ...args: Parameters<typeof SceneManager['get'][S]>) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.scene.set((this.get[scene] as any)(...args));
		this.current.set(scene);

		switch(scene) {
			case SCENE.INTRO:
			case SCENE.GAME:
			case SCENE.RESULT:
			case SCENE.SELECT:
			case SCENE.ADDONS:
				this.displayAlpha.set(false);
				return;
			default:
				this.displayAlpha.set(true);
		}
	}

}

if (!persisted.initialized) {
	persisted.initialized = true;
	// dev: a skill edit forces a full reload, wiping the in-memory scene. If the
	// strain debug was open, boot straight back into song select so it reopens.
	if (import.meta.env.DEV && sessionStorage.getItem(STRAIN_DEBUG_KEY)) {
		SceneManager.set(SCENE.SELECT);
	} else {
		SceneManager.set(SCENE.INTRO);
	}
}