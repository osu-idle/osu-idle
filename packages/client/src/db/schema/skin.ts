import type { SkinStatus } from '@osu-idle/shared/skin';
import {
	boolean,
	DAO,
	integer,
	table,
	text,
} from '../dao';
import Skin, { currentSkin } from '../../osu/skin/Skin';
import Log from '@osu-idle/shared/helpers/log';
import { t } from '@lingui/core/macro';
import { Skin as SkinDTO } from '../../online/skins';

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

	async setEnabled(enabled: boolean): Promise<void> {
		try {
			currentSkin.set(new Skin(JSON.parse(this.definition)));
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
		return SkinDAO.first(`SELECT * FROM skin WHERE enabled = 1 LIMIT 1`);
	}

	public static fromSkinDTO(dto: SkinDTO): SkinDAO {
		const dao = new SkinDAO({
			...dto,
			enabled: false,
			installedAt: Date.now(),
		});

		return dao;
	}

	public toSkinDTO(): SkinDTO {
		return { ...this };
	}
}