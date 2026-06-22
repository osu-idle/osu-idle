import { message } from '../globals';
import { Addon } from '../db/schema/addon';

/**
 * Add-on runtime. Add-ons are unsandboxed userscripts: we run them by turning
 * their source into an ES module (via a Blob URL) and importing it in the page
 * realm, so they have full window/DOM access. The *only* contract is the two
 * exports `mount` / `unmount` - no API is handed to them.
 *
 * A live add-on's `unmount` is held here so enabling/disabling, updating, or
 * uninstalling can tear it down cleanly without a page reload.
 */

type AddonModule = {
	mount?: () => void,
	unmount?: () => void,
};

/** Loaded add-ons, by add-on id → its `unmount` (if any). */
const live = new Map<number, () => void>();

/** Import an add-on's source as an ES module (full page access, real exports). */
const load = async (source: string): Promise<AddonModule> => {
	const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
	try {
		return await import(/* @vite-ignore */ url) as AddonModule;
	} finally {
		URL.revokeObjectURL(url);
	}
};

/** Run an add-on's source: import, call `mount`, and remember its `unmount`. */
const mount = async (id: number, name: string, source: string): Promise<void> => {
	if (live.has(id)) return;
	try {
		const mod = await load(source);
		mod.mount?.();
		live.set(id, mod.unmount ?? (() => {}));
	} catch (e) {
		console.error(`Add-on "${name}" failed to load`, e);
		message.set(`Add-on "${name}" failed to load`);
	}
};

/** Tear down a live add-on (its `unmount`), if running. */
const unmount = (id: number, name: string): void => {
	const stop = live.get(id);
	if (!stop) return;
	live.delete(id);
	try {
		stop();
	} catch (e) {
		console.error(`Add-on "${name}" failed to unmount`, e);
	}
};

/** Enable an installed add-on: persist the flag and mount it. */
export const enableAddon = async (addon: Addon): Promise<void> => {
	await addon.setEnabled(true);
	await mount(addon.id, addon.name, addon.source);
};

/** Disable an installed add-on: persist the flag and unmount it. */
export const disableAddon = async (addon: Addon): Promise<void> => {
	await addon.setEnabled(false);
	unmount(addon.id, addon.name);
};

/** Uninstall an add-on: unmount (if live) and drop its local row. */
export const uninstallAddon = async (addon: Addon): Promise<void> => {
	unmount(addon.id, addon.name);
	await addon.uninstall();
};

/** Swap a running add-on's source after an update: unmount old, mount new. */
export const remountAddon = async (addon: Addon): Promise<void> => {
	unmount(addon.id, addon.name);
	if (addon.enabled) await mount(addon.id, addon.name, addon.source);
};

/** On boot, mount every enabled installed add-on. */
export const bootAddons = async (): Promise<void> => {
	const installed = await Addon.getAll();
	await Promise.all(installed.filter(a => a.enabled).map(a => mount(a.id, a.name, a.source)));
};
