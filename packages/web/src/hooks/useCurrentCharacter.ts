import {
	useEffect,
	useState,
} from 'react';
import type { CharacterDTO } from '@osu-idle/shared/character';
import { getMyCharacter } from '../api/characters';
import { useCurrentUser } from './useCurrentUser';

/** The signed-in account's character (null when signed out or not yet
 *  onboarded). Use for self links like "My Profile", where the target is the
 *  user's character id - distinct from the account/user id. */
export function useCurrentCharacter(): CharacterDTO | null {
	const user = useCurrentUser();
	const [character, setCharacter] = useState<CharacterDTO | null>(null);

	useEffect(() => {
		if (!user) { setCharacter(null); return; }

		let active = true;
		getMyCharacter()
			.then(c => { if (active) setCharacter(c); })
			.catch(() => { if (active) setCharacter(null); });
		return () => { active = false; };
	}, [user]);

	return character;
}
