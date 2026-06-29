import type { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import {
	createNodeWebSocket,
	type NodeWebSocket,
} from '@hono/node-ws';
import { clientMessage } from '@osu-idle/shared/community/wire';
import { isAdmin } from '@osu-idle/shared/admin';
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
	touch,
	update,
} from './presence';
import { handleChat } from './chat';

/** Chat username colours: a soft pink for players, purple for admins. */
const PLAYER_NAME_COLOR = '#fff09a';
const ADMIN_NAME_COLOR = '#b06cff';

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
export const registerWs = (app: Hono): Pick<NodeWebSocket, 'injectWebSocket'> => {
	const {
		upgradeWebSocket, injectWebSocket,
	} = createNodeWebSocket({ app });

	app.get('/v1/ws', upgradeWebSocket(async c => {
		const token = wsToken(c);
		const session = token ? await verifySession(token).catch(() => undefined) : undefined;
		const resolved = session ? await resolveCharacter(session.uid) : undefined;

		if (!resolved) {
			return { onOpen: (_e, ws) => ws.close(1008, 'unauthorized') };
		}

		const { character, user } = resolved;
		const geo = await geoLookup(clientIp(c), user.country);
		let beat: ReturnType<typeof setInterval> | undefined;

		return {
			onOpen: async (_e, ws) => {
				hub.add(character.id, ws);
				// join() broadcasts our entry; the snapshot below already includes it.
				await join({
					character, user, geo,
				});
				hub.sendLocal(ws, {
					type: 'presence:init', entries: await presenceSnapshot(),
				});
				beat = setInterval(() => void touch(character.id), TOUCH_MS);
			},
			onMessage: async evt => {
				if (typeof evt.data !== 'string') return;
				let raw: unknown;
				try {
					raw = JSON.parse(evt.data);
				} catch {
					return;
				}
				const parsed = clientMessage.safeParse(raw);
				if (!parsed.success) return;
				const msg = parsed.data;

				if (msg.type === 'chat') {
					await handleChat({
						characterId: character.id,
						name: character.name,
						color: isAdmin(user.id) ? ADMIN_NAME_COLOR : PLAYER_NAME_COLOR,
					}, msg.channel, msg.text);
				} else if (msg.type === 'status') {
					await update(character.id, { status: msg.status });
				}
			},
			onClose: (_e, ws) => {
				if (beat) clearInterval(beat);
				hub.remove(character.id, ws);
				void leave(character.id);
			},
		};
	}));

	return { injectWebSocket };
};
