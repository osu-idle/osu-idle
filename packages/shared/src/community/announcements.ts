import num from '../display/num.js';

/** The chat text server-announced when a character takes #1 on a beatmap; the
 *  `perfect` variant is a max (1,000,000) score. Kept pure so it's testable and
 *  shared between the announcer and any future consumer. */
export const firstPlaceMessage = (
	name: string,
	beatmap: { artist: string; title: string; version: string },
	perfect: boolean,
): string =>
	`${name} achieved ${perfect ? 'a perfect rank #1' : 'rank #1'} on `
	+ `${beatmap.artist} - ${beatmap.title} [${beatmap.version}]`;

export const billionsMessage = (
	name: string,
	score: number,
): string => `${name} achieved a total ranked score of ${num(score)} !`;