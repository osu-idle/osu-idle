import Socket from './socket';
import Account from './account';

// The server owns the character and pushes it whenever the row moves - a play's
// xp, a purchase parked during one, a rebirth from another device. Taking it
// here is what keeps every screen on the same character: nothing asks for it,
// so nothing is left holding a copy from whenever it last managed to.
Socket.on('character', msg => void Account.character.set(msg.character));
