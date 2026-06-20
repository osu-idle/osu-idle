import Listener from '@osu-idle/shared/helpers/listener';
import Synced from '@osu-idle/shared/helpers/synced';
import SceneManager, { SCENE } from '../scenes/SceneManager';
import { SETTINGS } from '../db/settings';
import { isOptionsOpen, isStandalone, message } from '../globals';

type KeyCallback = (press: boolean, release: boolean) => void;

class KeyListener extends Listener<KeyCallback> {

	public onPress(callback: () => void): () => void {
		const press = (press: boolean) => {
			if (press) callback();
		};
		this.on(press);
		return () => this.off(press);
	}

	public onRelease(callback: () => void): () => void {
		const press = (_press: boolean, release: boolean) => {
			if (release) callback();
		};
		this.on(press);
		return () => this.off(press);
	}

	/** React hook variants of {@link onPress}/{@link onRelease}: see {@link Listener.use}. */
	public usePress(callback: () => void): void {
		this.use((press: boolean) => { if (press) callback(); });
	}

	public useRelease(callback: () => void): void {
		this.use((_press: boolean, release: boolean) => { if (release) callback(); });
	}
}

export default class Controls {

	public static volumeUp = new KeyListener();
	public static volumeDown = new KeyListener();

	public static confirm = new KeyListener();
	public static back = new KeyListener();
	public static skip = new KeyListener();
	
	public static previous = new KeyListener();
	public static next = new KeyListener();

	// debug transport (gated to debug mode by the gameplay scene)
	public static pause = new KeyListener();
	public static seekForward = new KeyListener();
	public static seekBack = new KeyListener();
	
	public static increaseScrollSpeed = new KeyListener();
	public static decreaseScrollSpeed = new KeyListener();
	
	public static openOptions = new KeyListener();

	public static shift = new KeyListener();
	public static control = new KeyListener();
	public static alt = new KeyListener();

	public static mode_Shift = new Synced(false);
	public static mode_Control = new Synced(false);
	public static mode_Alt = new Synced(false);

	private static initialized = false;
	public static init() {
		if (this.initialized) return;
		this.initialized = true;

		this.shift.onPress(() => this.mode_Shift.set(true));
		this.shift.onRelease(() => this.mode_Shift.set(false));

		this.control.onPress(() => this.mode_Control.set(true));
		this.control.onRelease(() => this.mode_Control.set(false));

		this.alt.onPress(() => this.mode_Alt.set(true));
		this.alt.onRelease(() => this.mode_Alt.set(false));

		const syncModifiers = (e: KeyboardEvent | MouseEvent | WheelEvent) => {
			if (this.mode_Shift.get() !== e.shiftKey) this.mode_Shift.set(e.shiftKey);
			if (this.mode_Control.get() !== e.ctrlKey) this.mode_Control.set(e.ctrlKey);
			if (this.mode_Alt.get() !== e.altKey) this.mode_Alt.set(e.altKey);
		};

		// eslint-disable-next-line complexity
		const handle = async (e: KeyboardEvent, press: boolean, release: boolean) => {
			syncModifiers(e);
			switch(e.key.toLowerCase()) {
				case 'control':
					this.control.trigger(press, release);
					break;
				case 'shift':
					this.shift.trigger(press, release);
					break;
				case 'alt':
					e.preventDefault();
					this.alt.trigger(press, release);
					break;
				//@ts-expect-error fallsthrough
				case 'browserback':
					e.preventDefault();
				case 'escape':
					this.back.trigger(press, release);
					break;
				case 'enter':
					this.confirm.trigger(press, release);
					break;
				case ' ':
					this.skip.trigger(press, release);
					this.pause.trigger(press, release);
					break;
				case 'arrowright':
				case 'arrowdown':
					this.next.trigger(press, release);
					this.seekForward.trigger(press, release);
					break;
				case 'arrowleft':
				case 'arrowup':
					this.previous.trigger(press, release);
					this.seekBack.trigger(press, release);
					break;
				case 'f4':
					await this.increaseScrollSpeed.trigger(press, release);
					break;
				case 'f3':
					e.preventDefault();
					e.stopPropagation();
					await this.decreaseScrollSpeed.trigger(press, release);
					break;
				case 'o':
					if ((this.mode_Control.get() && this.mode_Shift.get())
						|| (this.mode_Control.get() && isStandalone.get())) {
						e.preventDefault();
						e.stopPropagation();
						await this.openOptions.trigger(press, release);
					}
					break;
			}
		};
		
		// ignore OS key auto-repeat: a held key emits repeated keydowns, and since
		// back/skip aren't held actions, a repeat that lands after a scene swap would
		// re-trigger on the freshly-mounted scene (e.g. result → select → menu on one
		// long Escape press). The genuine press/release pair still fires.
		window.addEventListener('keydown', (e) => { if (!e.repeat) handle(e, true, false); });
		window.addEventListener('keyup', (e) => handle(e, false, true));

		window.addEventListener('wheel', syncModifiers, { capture: true });
		window.addEventListener('pointerdown', syncModifiers, { capture: true });
		window.addEventListener('pointermove', syncModifiers, { capture: true });

		// right click is a game input (carousel scrub, contextual menus) - never
		// the browser menu. The in-game web browser is an iframe, i.e. its own
		// document, so it keeps the native menu untouched.
		window.addEventListener('contextmenu', (e) => e.preventDefault());

		window.addEventListener('wheel', (e) => {
			if (this.mode_Alt.get() || (SceneManager.current.get() === SCENE.MENU && !isOptionsOpen.get())) {
				if (e.deltaY > 0) {
					this.volumeDown.trigger(false, false);
				} else {
					this.volumeUp.trigger(false, false);
				}
			}
		});

		this.increaseScrollSpeed.onPress(async () => {
			if (SETTINGS.scrollspeed.get() >= 40) return;
			const next = SETTINGS.scrollspeed.get() + 1;
			await SETTINGS.scrollspeed.set(next);
			message.set(`osu!mania speed set to ${next}`);
		});

		this.decreaseScrollSpeed.onPress(async () => {
			if (SETTINGS.scrollspeed.get() <= 1) return;
			const prev = SETTINGS.scrollspeed.get() - 1;
			await SETTINGS.scrollspeed.set(prev);
			message.set(`osu!mania speed set to ${prev}`);
		});

		this.openOptions.onPress(async () => {
			isOptionsOpen.set(!isOptionsOpen.get());
		});
	}

}

Controls.init();