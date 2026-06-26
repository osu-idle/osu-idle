import type { SkinStatus } from '@osu-idle/shared/skin';
import Synced from '@osu-idle/shared/helpers/synced';
import {
	boolean,
	DAO,
	integer,
	table,
	text,
} from '../dao';
import Skin, {
	currentSkin,
	currentSkinDAO,
} from '../../osu/skin/Skin';
import Log from '@osu-idle/shared/helpers/log';
import { t } from '@lingui/core/macro';
import {
	Skin as SkinDTO,
	SkinDetail,
} from '../../online/skins';

const skin = table('skin', {
	id:          integer().primaryKey(),
	name:        text(),
	description: text(),
	version:     text(),
	definition:  text(),
	icon:        text().nullable(),
	authorId:    integer(),
	authorName:  text(),
	tags:        text(),
	status:      text<SkinStatus>(),
	enabled:     boolean(),
	installedAt: integer(),
	createdAt:   text(),
	publishedAt: text().nullable(),
	updatedAt:   text(),
});

export class SkinDAO extends DAO(skin) {

	// Every persist refreshes the reactive list, so install / update / enable /
	// uninstall reach every view through `installedSkins` with no manual signal.
	async add(): Promise<this> {
		const r = await super.add();
		await reloadInstalledSkins();
		return r;
	}

	async update(patch?: Partial<SkinDAO>): Promise<this> {
		const r = await super.update(patch);
		await reloadInstalledSkins();
		return r;
	}

	async delete(): Promise<void> {
		await super.delete();
		await reloadInstalledSkins();
	}

	async setEnabled(enabled: boolean, ignore = false): Promise<void> {
		this.enabled = enabled;
		try {
			if (!ignore) {
				(await SkinDAO.getAll())
					.filter(skin => skin.id !== this.id && skin.enabled)
					.forEach(skin => skin.setEnabled(false, true))
				;
			}
			if (enabled) {
				currentSkinDAO.set(this);
			} else if (!ignore) {
				currentSkinDAO.set(undefined);
			}
			await this.update({ enabled });
		} catch {
			Log.errorPopup(t`Unable to load "${this.name}": Malformed definition`);
		}
	}

	async uninstall(): Promise<void> {
		await this.delete();
		if (this.enabled) {
			currentSkin.set(new Skin());
		}
	}

	public static async getEnabled(): Promise<SkinDAO | undefined> {
		return SkinDAO.first('SELECT * FROM skin WHERE enabled = 1 LIMIT 1');
	}

	public static fromSkinDTO(dto: SkinDTO): SkinDAO {
		const dao = new SkinDAO({
			...dto,
			enabled: false,
			installedAt: Date.now(),
		});

		return dao;
	}

	public toSkinDTO(): SkinDetail {
		return { ...this };
	}
}

/**
 * Reactive list of installed skins - the single source of truth the skin lists
 * render from, kept current by the DAO write methods above.
 */
export const installedSkins = new Synced<SkinDAO[]>([]);

const reloadInstalledSkins = async (): Promise<void> => {
	installedSkins.set(await SkinDAO.getAll());
};

void reloadInstalledSkins();