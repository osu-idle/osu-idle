import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
	characters,
	characterToDTO,
} from '../db/schema/character';
import { users } from '../db/schema/user';
import { hub } from '../ws/hub';
import type { CharacterDTO } from '@osu-idle/shared/character';

/**
 * Hand the character to its own devices.
 *
 * The client's copy is a mirror of this row, and a mirror nobody writes to goes
 * stale: a play's xp, a deferred purchase, a rebirth from another device all
 * move the row without the client asking again. So every change announces
 * itself here, and what a player is shown is never older than what the server
 * last did to them.
 */
export const pushCharacter = async (characterId: number): Promise<void> => {
	const [row] = await db
		.select()
		.from(characters)
		.innerJoin(users, eq(users.id, characters.userId))
		.where(eq(characters.id, characterId))
		.limit(1);
	if (!row) return;

	announceCharacter(characterToDTO(row.character, row.user.avatarUrl, row.user.country));
};

/** The same announcement, for a caller that already read the row - a route
 *  answering with the character it just changed. */
export const announceCharacter = (character: CharacterDTO): void => {
	hub.sendTo(character.id, {
		type: 'character', character,
	});
};
