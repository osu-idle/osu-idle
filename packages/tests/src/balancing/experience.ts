import { ValueIn } from '@osu-idle/shared/helpers/mapped';

export const PROFILE = {
	/** Lvl 0 : Player just starting out the game, human baseline */
	BEGINNER: 'Beginner',
	/** Lvl 5 : New player after just a few maps */
	NEWBIE: 'Newbie',
	/** Lvl 10 : New player after a full session / Very few sessions */
	CASUAL: 'Casual',
	/** Lvl 20 : A player with a few sessions already */
	REGULAR: 'Regular',
	/** Lvl 30 : Around a month of IRL experience */
	CONFIRMED: 'Confirmed',
	/** Lvl 50 : A few months of IRL experience */
	SEASONED: 'Seasoned',
	/** Lvl 75 : Around 1 year of IRL experience */
	GOOD: 'Good',
	/** Lvl 90 : Few years of IRL experience, some real players cap there */
	EXPERT: 'Expert',
	/** Lvl 100 : Few years of IRL experience, extensive training + Very good dispositions */
	PRO: 'Pro',
};
export type Profile = ValueIn<typeof PROFILE>;

export const LEVEL: {[key in Profile]: number} = {
	[PROFILE.BEGINNER]: 0,
	[PROFILE.NEWBIE]: 5,
	[PROFILE.CASUAL]: 10,
	[PROFILE.REGULAR]: 20,
	[PROFILE.CONFIRMED]: 30,
	[PROFILE.SEASONED]: 50,
	[PROFILE.GOOD]: 75,
	[PROFILE.EXPERT]: 90,
	[PROFILE.PRO]: 100,
} as const;