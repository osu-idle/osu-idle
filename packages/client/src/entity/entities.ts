import Synced from '@osu-idle/shared/helpers/synced';
import Character from '../db/schema/character';

export default class Entities {

	// Placeholder until the session resolves. online/account.ts swaps in the real
	// account character (or guest, once we KNOW we're signed out) after online
	// auth answers - we deliberately do NOT pre-seed guest here, so a play started
	// mid-validation can't be scored as guest. Play start waits on Account.ready().
	public static character = new Synced<Character>(new Character({ 
		id: 0, 
		name: 'Loading...', 
	}));

}
