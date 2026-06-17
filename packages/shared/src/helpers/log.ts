import Listener from './listener.js';
import { mapped, type ValueIn } from './mapped.js';

export const POPUP_TYPE = mapped([
	'good',
	'bad',
	'neutral',
]);
export type PopupType = ValueIn<typeof POPUP_TYPE>;

export type Popup = {
	id: number,
	message: string,
	type: PopupType,
	sticky: boolean,
};

export default class Log {

	public static readonly listeners = {
		popup: new Listener<(popup: Popup) => void>(),
	} as const;

	private static nextPopupId = 0;

	public static popup(message: string, type: PopupType = POPUP_TYPE.neutral, sticky = false) {
		void Log.listeners.popup.trigger({ id: Log.nextPopupId++, message, type, sticky });
	}

	public static errorPopup(message: string) {
		Log.popup(message, POPUP_TYPE.bad);
	}
}

Listener.onError = e => Log.errorPopup(String(e));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') (window as any).toast = Log.popup;