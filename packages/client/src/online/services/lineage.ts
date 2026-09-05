import type { CharacterDTO } from '@osu-idle/shared/character';
import Log from '@osu-idle/shared/helpers/log';
import { rpc } from '../client';
import Account from '../account';
import Entities from '../../entity/entities';
import Character from '../../db/schema/character';

/** Every character the player owns, oldest generation first. Guests read their
 *  local lineage; signed-in accounts read the server's. */
export const listCharacters = async (): Promise<Character[]> => {
	if (Entities.character.get().isGuest()) return await Character.locals();

	const res = await rpc.v1.me.characters.$get();
	if (!res.ok) return [];
	const dtos = await res.json() as CharacterDTO[];
	return dtos.map(dto => Character.fromDTO(dto));
};

/** Make one of the player's other characters live. */
export const selectCharacter = async (characterId: number): Promise<boolean> => {
	if (Entities.character.get().isGuest()) {
		const character = await Character.get({ id: characterId });
		if (!character || !character.isGuest()) return false;
		await character.makeCurrent();
		Entities.character.set(character);
		return true;
	}

	const res = await rpc.v1.me.character.select.$post({ json: { characterId } });
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		Log.errorPopup(`Switch failed (${res.status})${detail ? `: ${detail}` : ''}`);
		return false;
	}
	await Account.character.set(await res.json());
	return true;
};
