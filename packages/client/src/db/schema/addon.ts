import Synced from '@osu-idle/shared/helpers/synced';
import type { AddonStatus } from '@osu-idle/shared/addon';
import { boolean, DAO, integer, table, text } from '../dao';

// Installed add-ons (per-browser). `id` is the server add-on id, so reinstalling
// or updating overwrites the same row (the DAO inserts OR REPLACE). `source` is
// kept locally so enabled add-ons run offline; the other fields are a display
// snapshot of the catalog entry at install/update time.
const addon = table('addon', {
	id:          integer().primaryKey(),
	name:        text(),
	description: text(),
	version:     text(),
	source:      text(),
	icon:        text().nullable(),
	authorId:    integer(),
	authorName:  text(),
	tags:        text(), // comma-separated
	status:      text<AddonStatus>(),
	enabled:     boolean(),
	installedAt: integer(),
});

/** Bumped on every install/enable/uninstall so the manage view re-queries. */
export const addonsVersion = new Synced(0);
const touch = () => addonsVersion.set(addonsVersion.get() + 1);

export class Addon extends DAO(addon) {

	async setEnabled(enabled: boolean): Promise<void> {
		await this.update({ enabled });
		touch();
	}

	async uninstall(): Promise<void> {
		await this.delete();
		touch();
	}
}
