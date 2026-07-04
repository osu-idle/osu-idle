import type { WSContext } from 'hono/ws';
import type { ClientMessage } from '@osu-idle/shared/community/wire';
import type { CharacterRow } from '../db/schema/character';
import {
	abortPlay,
	fetchResult,
	playState,
	skipPlay,
	startPlay,
	streamOffsets,
} from '../play';
import { hub } from './hub';

/**
 * The play consumer of the community socket. Commands (start/skip/abort/result)
 * call straight into the play core, which pushes state changes to every one of
 * the character's sockets itself; the {@link PlayFeed} covers the one thing no
 * event fires for - time-based reveals - by polling Redis for the socket that
 * asked to watch.
 */

/** Feed cadence. Offsets stay well under the server's reveal buffer so a
 *  replaying client never out-runs its data. */
const FEED_TICK_MS = 1500;

/** One socket's play feed - at most one watch at a time. With a cursor it
 *  streams replay offsets (gameplay); without one it pushes live state
 *  checkpoints (the song-select resume banner). Stops itself once the play is
 *  fully delivered or no longer live. */
export class PlayFeed {

	private timer?: ReturnType<typeof setInterval>;
	private token?: string;
	private next?: number;
	private lastState?: string;
	private ticking = false;

	constructor(
		private readonly characterId: number,
		private readonly ws: WSContext,
	) {}

	public watch(token: string, next?: number): void {
		this.stop();
		this.token = token;
		this.next = next;
		this.lastState = undefined;
		this.timer = setInterval(() => void this.tick(), FEED_TICK_MS);
		void this.tick();
	}

	public stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
	}

	private async tick(): Promise<void> {
		const token = this.token;
		if (this.ticking || !token) return; // a slow Redis read must not stack ticks
		this.ticking = true;
		try {
			if (this.next !== undefined) await this.streamTick(token);
			else await this.stateTick(token);
		} catch (e) {
			console.error('[play] feed tick failed for', this.characterId, e);
		} finally {
			this.ticking = false;
		}
	}

	/** Push the offsets revealed since the cursor; a final (possibly empty) done
	 *  chunk closes the stream client-side. */
	private async streamTick(token: string): Promise<void> {
		const chunk = await streamOffsets(this.characterId, token, this.next!);
		if (chunk.offsets.length || chunk.done) {
			hub.sendLocal(this.ws, {
				type: 'play:offsets', token, ...chunk,
			});
		}
		this.next = chunk.next;
		if (chunk.done) this.stop();
	}

	/** Push the play state whenever its checkpoint moves; the terminal state
	 *  (finished/idle/another play) is pushed once, then the feed stops. */
	private async stateTick(token: string): Promise<void> {
		const state = await playState(this.characterId);
		const live = state.phase === 'active' && state.token === token;
		const key = state.phase === 'active'
			? `${state.token}:${state.accuracy}:${state.grade}`
			: state.phase;
		if (key !== this.lastState) {
			this.lastState = key;
			hub.sendLocal(this.ws, {
				type: 'play:state', state,
			});
		}
		if (!live) this.stop();
	}

}

type PlaySession = {
	character: CharacterRow,
	ws: WSContext,
	feed: PlayFeed,
	/** re-reads the character row - its skills level up between plays, and the
	 *  authoritative simulation must run on the current state, not the row
	 *  resolved when the socket connected */
	freshCharacter: () => Promise<CharacterRow | undefined>,
};

/** Handle one play-scoped message. Returns false for anything else. */
export const handlePlay = async (
	msg: ClientMessage,
	{
		character, ws, feed, freshCharacter,
	}: PlaySession,
): Promise<boolean> => {
	switch (msg.type) {
		case 'play:start': {
			// always answer - a start left hanging stalls the client until timeout
			try {
				const fresh = await freshCharacter() ?? character;
				console.log(fresh.name, 'wants to play', msg.beatmapId);
				const result = await startPlay(fresh, msg.beatmapId);
				console.log(fresh.name, 'play status', result.status);
				hub.sendLocal(ws, {
					type: 'play:start', result,
				});
			} catch (e) {
				console.error('[play] start failed for', character.id, e);
				hub.sendLocal(ws, {
					type: 'play:start', result: { status: 'refused' },
				});
			}
			return true;
		}
		case 'play:watch':
			feed.watch(msg.token, msg.next);
			return true;
		case 'play:unwatch':
			feed.stop();
			return true;
		case 'play:skip':
			await skipPlay(character.id, msg.token);
			return true;
		case 'play:abort':
			await abortPlay(character.id, msg.token);
			return true;
		case 'play:result':
			hub.sendLocal(ws, {
				type: 'play:result',
				token: msg.token,
				result: await fetchResult(character.id, msg.token, msg.forceSee ?? false),
			});
			return true;
		default:
			return false;
	}
};
