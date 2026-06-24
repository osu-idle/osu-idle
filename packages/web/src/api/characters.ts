import {
	rpc,
	unwrap,
} from './client';

/** Public: a single character by id. */
export const getCharacter = (id: number | string) =>
	unwrap(rpc.v1.characters[':id'].$get({ param: { id: String(id) } }));

/** Public: a character's derived profile statistics. */
export const getCharacterStats = (id: number | string) =>
	unwrap(rpc.v1.characters[':id'].stats.$get({ param: { id: String(id) } }));

/** The signed-in account's own character, or null when onboarding is needed. */
export const getMyCharacter = () =>
	unwrap(rpc.v1.me.character.$get());

export const getCharacterMostPlayed = (id: number | string, page: number | string) =>
	unwrap(rpc.v1.characters[':id'].mostplayed[':page'].$get({
		param: {
			id: String(id), page: String(page), 
		}, 
	}));
export const getCharacterCountPlayed = (id: number | string) =>
	unwrap(rpc.v1.characters[':id'].countplayed.$get({ param: { id: String(id) } }));
	
export const getCharacterBestPP = (id: number | string, page: number | string) =>
	unwrap(rpc.v1.characters[':id'].bestpp[':page'].$get({
		param: {
			id: String(id), page: String(page), 
		}, 
	}));
	
export const getCharacterNbFirstPlaces = (id: number | string) =>
	unwrap(rpc.v1.characters[':id'].countfirstplaces.$get({ param: { id: String(id) } }));
export const getCharacterFirstPlaces = (id: number | string, page: number | string) =>
	unwrap(rpc.v1.characters[':id'].firstplaces[':page'].$get({
		param: {
			id: String(id), page: String(page), 
		}, 
	}));
	
export const getCharacterRecent = (id: number | string, page: number | string) =>
	unwrap(rpc.v1.characters[':id'].recent[':page'].$get({
		param: {
			id: String(id), page: String(page), 
		}, 
	}));