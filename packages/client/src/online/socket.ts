import Synced from '@osu-idle/shared/helpers/synced';
import { desktop } from '@osu-idle/shared/desktop';
import {
	type ChatLine,
	type ClientMessage,
	DEFAULT_CHANNEL,
	serverMessage,
} from '@osu-idle/shared/community/wire';
import {
	type ClientStatus,
	type PresenceEntry,
} from '@osu-idle/shared/community/presence';
import Account from './account';
import { BASE_URL } from './client';

/** Reconnect backoff, mirroring API.fetch: 1s, 2s, 4s … capped at 15s. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

/** Mark ourselves AFK after this long without input. */
const AFK_MS = 60_000;

/** Keep at most this many chat lines in memory (no server history anyway). */
const CHAT_LIMIT = 200;

const WS_OPEN = 1;
const WS_CONNECTING = 0;

/**
 * The single community WebSocket. A typed message bus shared with the server
 * (`serverMessage`/`clientMessage`): presence, the online count and chat travel
 * over it. Connects whenever a real (non-guest) account is live and auto-
 * reconnects with backoff; the open connection is itself our presence signal.
 *
 * Built to grow - new server features just add a message variant, not a socket.
 */
export default class Socket {

	public static readonly presence = new Synced<PresenceEntry[]>([]);
	public static readonly online = new Synced(0);
	public static readonly chat = new Synced<ChatLine[]>([]);
	public static readonly connected = new Synced(false);

	private static ws?: WebSocket;
	private static started = false;
	private static wanted = false;
	private static attempt = 0;
	private static reconnectTimer?: ReturnType<typeof setTimeout>;
	private static afkTimer?: ReturnType<typeof setTimeout>;
	private static status: ClientStatus = 'idle';

	public static start(): void {
		if (this.started) return;
		this.started = true;

		// Connect only once the session is resolved to a real account character.
		void Synced.all([Account.character, Account.resolved], ([character, resolved]) => {
			if (resolved && character) this.open();
			else this.close();
		});

		this.watchActivity();
	}

	public static sendChat(text: string, channel: string = DEFAULT_CHANNEL): void {
		this.send({
			type: 'chat', channel, text,
		});
	}

	private static send(msg: ClientMessage): void {
		if (this.ws?.readyState === WS_OPEN) this.ws.send(JSON.stringify(msg));
	}

	private static open(): void {
		this.wanted = true;
		if (this.ws && (this.ws.readyState === WS_OPEN || this.ws.readyState === WS_CONNECTING)) return;

		const base = (BASE_URL || location.origin).replace(/^http/, 'ws');
		const token = desktop()?.getToken();
		const url = `${base}/v1/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

		const ws = this.ws = new WebSocket(url);
		ws.onopen = () => {
			this.attempt = 0;
			this.connected.set(true);
			this.status = 'idle';
		};
		ws.onmessage = e => this.receive(e);
		ws.onclose = () => {
			this.connected.set(false);
			if (this.ws === ws) this.ws = undefined;
			if (this.wanted) this.scheduleReconnect();
		};
		ws.onerror = () => ws.close();
	}

	private static close(): void {
		this.wanted = false;
		clearTimeout(this.reconnectTimer);
		this.ws?.close();
		this.ws = undefined;
		this.connected.set(false);
		void this.presence.set([]);
		void this.online.set(0);
	}

	private static scheduleReconnect(): void {
		const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.attempt, RECONNECT_MAX_MS);
		this.attempt++;
		clearTimeout(this.reconnectTimer);
		this.reconnectTimer = setTimeout(() => {
			if (this.wanted) this.open();
		}, delay);
	}

	private static receive(e: MessageEvent): void {
		if (typeof e.data !== 'string') return;
		let raw: unknown;
		try {
			raw = JSON.parse(e.data);
		} catch {
			return;
		}
		const parsed = serverMessage.safeParse(raw);
		if (!parsed.success) return;
		const msg = parsed.data;

		switch (msg.type) {
			case 'presence:init':
				void this.presence.set(msg.entries);
				break;
			case 'presence:add':
			case 'presence:update': {
				const rest = this.presence.get().filter(p => p.characterId !== msg.entry.characterId);
				void this.presence.set([...rest, msg.entry]);
				break;
			}
			case 'presence:remove':
				void this.presence.set(
					this.presence.get().filter(p => p.characterId !== msg.characterId),
				);
				break;
			case 'online':
				void this.online.set(msg.count);
				break;
			case 'chat':
				void this.chat.set([...this.chat.get(), msg.line].slice(-CHAT_LIMIT));
				break;
			case 'error':
				console.warn('Community:', msg.message);
				break;
		}
	}

	/** Report idle/afk from local input activity, rearming an inactivity timer. */
	private static watchActivity(): void {
		const wake = () => {
			this.setStatus('idle');
			clearTimeout(this.afkTimer);
			this.afkTimer = setTimeout(() => this.setStatus('afk'), AFK_MS);
		};
		for (const ev of ['pointermove', 'pointerdown', 'keydown'] as const) {
			window.addEventListener(ev, wake, { passive: true });
		}
		wake();
	}

	private static setStatus(status: ClientStatus): void {
		if (this.status === status || this.ws?.readyState !== WS_OPEN) return;
		this.status = status;
		this.send({
			type: 'status', status,
		});
	}

}
