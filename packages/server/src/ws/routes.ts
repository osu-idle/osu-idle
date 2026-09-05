import type { ZodError } from 'zod';
import type { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import {
	createNodeWebSocket,
	type NodeWebSocket,
} from '@hono/node-ws';
import { clientMessage } from '@osu-idle/shared/community/wire';
import { VERSION } from '@osu-idle/shared/version';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
	characters,
	type CharacterRow,
} from '../db/schema/character';
import {
	users,
	type UserRow,
} from '../db/schema/user';
import { SESSION_COOKIE } from '../auth/middleware';
import { verifySession } from '../auth/jwt';
import {
	clientIp,
	geoLookup,
} from '../geo';
import { hub } from './hub';
import {
	join,
	leave,
	presenceSnapshot,
	recordAdoption,
	touch,
	update,
} from './presence';
import {
	handleChat,
	nameColor,
} from './chat';
import {
	isPlaying,
	livePlayPresence,
	playState,
} from '../play';
import {
	handlePlay,
	PlayFeed,
} from './play';

/** How often a live connection refreshes its presence last-seen (well under the
 *  sweep TTL) so a clean session is never pruned. */
const TOUCH_MS = 30 * 1000;

/** The session JWT for a WS upgrade: Bearer / cookie like REST, plus a `?token=`
 *  fallback because a browser can't set headers on a WebSocket and the desktop
 *  app has no cookie. */
const wsToken = (c: Context): string | undefined => {
	const auth = c.req.header('Authorization');
	if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
	return getCookie(c, SESSION_COOKIE) ?? c.req.query('token');
};

const resolveCharacter = async (
	userId: number,
): Promise<{ character: CharacterRow; user: UserRow } | undefined> => {
	const [row] = await db
		.select()
		.from(characters)
		.innerJoin(users, eq(users.currentCharacter, characters.id))
		.where(eq(users.id, userId))
		.limit(1);
	return row ? {
		character: row.character, user: row.user,
	} : undefined;
};

/**
 * Mount the community WebSocket at `/v1/ws`. Returns `injectWebSocket`, which the
 * server entrypoint attaches to the Node http server. Not part of `AppType` - the
 * socket is a typed message bus (shared `clientMessage`/`serverMessage`), not RPC.
 */
/** A message that fails validation is dropped, and a dropped message is
 *  indistinguishable from one the client never sent: whatever it asked for
 *  simply never happens, with nothing anywhere to say why. */
const reportDiscarded = (userId: number, raw: unknown, error: ZodError): void => {
	console.error('[ws] discarded an invalid message from', userId,
		(raw as { type?: string })?.type ?? '(no type)',
		error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
};

export const registerWs = (app: Hono): Pick<NodeWebSocket, 'injectWebSocket'> => {
	const {
		upgradeWebSocket, injectWebSocket,
	} = createNodeWebSocket({ app });

	app.get('/v1/ws', upgradeWebSocket(async c => {
		const token = wsToken(c);
		const session = token ? await verifySession(token).catch(() => undefined) : undefined;
		const resolved = session ? await resolveCharacter(session.uid) : undefined;

		if (!session || !resolved) {
			return { onOpen: (_e, ws) => ws.close(1008, 'unauthorized') };
		}

		const { character, user } = resolved;
		const userId = session.uid;
		const geo = await geoLookup(clientIp(c), user.country);
		let beat: ReturnType<typeof setInterval> | undefined;
		let feed: PlayFeed | undefined;

		return {
			onOpen: async (_e, ws) => {
				hub.add(character.id, ws);
				feed = new PlayFeed(character.id, ws);
				// join() broadcasts our entry; the snapshot below already includes it.
				await join({
					character, user, geo,
				});
				// join() resets status to idle; restore `playing` if mid-play so a
				// reconnect during gameplay doesn't show the player as idle.
				const live = await livePlayPresence(character.id);
				if (live) await update(character.id, live);
				hub.sendLocal(ws, {
					type: 'presence:init', entries: await presenceSnapshot(),
				});
				hub.sendLocal(ws, {
					type: 'version', version: VERSION,
				});
				// what (if anything) the character is playing, for resume/spectate
				hub.sendLocal(ws, {
					type: 'play:state', state: await playState(character.id),
				});
				beat = setInterval(() => void touch(character.id), TOUCH_MS);
			},
			onMessage: async (evt, ws) => {
				if (typeof evt.data !== 'string') return;
				let raw: unknown;
				try {
					raw = JSON.parse(evt.data);
				} catch {
					return;
				}
				const parsed = clientMessage.safeParse(raw);
				if (!parsed.success) return reportDiscarded(userId, raw, parsed.error);
				const msg = parsed.data;

				try {
					if (feed && await handlePlay(msg, {
						character,
						ws,
						feed,
						freshCharacter: async () => (await resolveCharacter(userId))?.character,
					})) return;
				} catch (e) {
					console.error('[play]', msg.type, 'failed for', character.id, e);
					return;
				}

				if (msg.type === 'chat') {
					await handleChat({
						characterId: character.id,
						name: character.name,
						color: nameColor(user.id),
					}, user.id, msg.channel, msg.text);
				} else if (msg.type === 'status') {
					// The client reports idle/afk from input activity; ignore it while
					// a play is live so it can't clobber the server-set `playing`.
					if (!(await isPlaying(character.id))) await update(character.id, { status: msg.status });
				} else if (msg.type === 'version') {
					await recordAdoption(character.id, msg.version, msg.platform);
				}
			},
			onClose: (_e, ws) => {
				if (beat) clearInterval(beat);
				feed?.stop();
				hub.remove(character.id, ws);
				void leave(character.id);
			},
		};
	}));

	return { injectWebSocket };
};
