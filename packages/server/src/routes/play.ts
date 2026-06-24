import { eq } from 'drizzle-orm';
import { characters } from '../db/schema/character';
import { users } from '../db/schema/user';
import { db } from '../db/client';
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware';
import { playRequest } from '@osu-idle/shared/play';
import { HTTPException } from 'hono/http-exception';
import {
	abortPlay,
	fetchResult,
	getActivePlay,
	playStatus,
	skipPlay,
	startPlay,
} from '../play';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** The signed-in user's active character row, or undefined if not onboarded. */
async function currentCharacter(userId: number) {
	const [row] = await db
		.select()
		.from(characters)
		.innerJoin(users, eq(users.currentCharacter, characters.id))
		.where(eq(users.id, userId))
		.limit(1);
	return row?.character;
}

/** The signed-in account's own character (created during first-login onboarding). */
export const playRoutes = new Hono()

	// Ask to start an online (ranked) play
	.post('/start', requireAuth, async c => {
		const { beatmapId } = playRequest.parse(await c.req.json());
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });

		console.log(character.name, 'wants to play', beatmapId);
		const result = await startPlay(character, beatmapId);

		return c.json(result.status === 'ranked'
			? {
				...result,
				ranked: true,
				serverNow: Date.now(),
			}
			: {
				...result,
				ranked: false,
			});
	})
	
	// Current play descriptor: what (if anything) this character is playing, for
	// resume-after-refresh and cross-tab spectating.
	.get('/state', requireAuth, async c => {
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });
		return c.json(await getActivePlay(character.id));
	})

	// Try to get the result of a finished play if not already consumed
	.get('/:token/result/:forceSee', requireAuth, async c => {
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });

		const result = await fetchResult(
			character.id, 
			c.req.param('token'), 
			c.req.param('forceSee') === 'true',
		);
		if (!result.ok) {
			throw new HTTPException(result.code as ContentfulStatusCode, { message: result.reason });
		}
		return c.json(result);
	})

	// Get specific play status (skipped, aborted)
	.get('/:token/heartbeat', requireAuth, async c => {
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });
		return c.json(await playStatus(character.id, c.req.param('token')));
	})

	// Lead-in skip: shift the play's timeline forward so it finalises earlier.
	.post('/:token/skip', requireAuth, async c => {
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });
		return c.json(await skipPlay(character.id, c.req.param('token')));
	})

	// Quit: drop the play without submitting (the player aborted from gameplay).
	.post('/:token/abort', requireAuth, async c => {
		const character = await currentCharacter(c.get('userId'));
		if (!character) throw new HTTPException(409, { message: 'No character' });
		return c.json(await abortPlay(character.id, c.req.param('token')));
	})
;