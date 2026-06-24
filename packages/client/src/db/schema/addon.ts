import Synced from '@osu-idle/shared/helpers/synced';
import type { AddonStatus } from '@osu-idle/shared/addon';
import {
	boolean,
	DAO,
	integer,
	table,
	text,
} from '../dao';

const addon = table('addon', {
	id:          integer().primaryKey(),
	name:        text(),
	description: text(),
	version:     text(),
	gameVersion: text(),
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
