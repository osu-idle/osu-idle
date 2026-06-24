import { z } from 'zod';
import { fallback } from '@tanstack/zod-adapter';

// Shared leaderboard search params. `-` prefix keeps this out of the route tree.
// `fallback` guards bad URLs (?page=foo) instead of tripping an error boundary;
// `.default` makes the param optional on Link `search`.
export const pageSearch = z.object({
	page: fallback(z.coerce
		.number()
		.int()
		.positive()
	, 1).default(1), 
});

export const pageCountrySearch = pageSearch.extend({ country: z.string().optional() });
