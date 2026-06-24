import Synced from '@osu-idle/shared/helpers/synced';

export const debugMode = new Synced(import.meta.env.DEV);

export const pageTitle = new Synced('');

/**
 * The shared dimming overlay. It's not owned by any one component - a dropdown,
 * modal, etc. raises it for itself and registers an `onClose` so it can cancel
 * its own state when the overlay is dismissed (clicked). Only one owner is active
 * at a time: raising it for a new owner closes the previous one first.
 */
export class Blackout {
	readonly active = new Synced(false);
	private onClose?: () => void;

	open(onClose: () => void) {
		this.onClose?.();
		this.onClose = onClose;
		this.active.set(true);
	}

	close() {
		const onClose = this.onClose;
		this.onClose = undefined;
		this.active.set(false);
		onClose?.();
	}
}

export const blackout = new Blackout();
