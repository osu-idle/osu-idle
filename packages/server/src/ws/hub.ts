import type { WSContext } from 'hono/ws';
import type { ServerMessage } from '@osu-idle/shared/community/wire';
import { redis } from '../redis';
import { redisKeyPrefix } from '../env';

/**
 * The WebSocket fan-out layer - feature-agnostic. Presence and chat are just
 * consumers: they hand it a {@link ServerMessage} and it reaches every connected
 * client, on any worker.
 *
 * Each worker keeps only its own sockets. Cross-worker delivery rides Redis
 * pub/sub: a publish on one worker is received by all (including the publisher),
 * and each forwards to the sockets it holds. A raw WebSocket stays on the worker
 * that accepted it for its whole life, so a character's sockets are always local
 * to one worker - but we still address by character through pub/sub so any worker
 * can reach any client without knowing where it lives.
 */

const CHANNEL = `${redisKeyPrefix}ws:broadcast`;

/**
 * What travels over the pub/sub channel: a message, optionally addressed to a
 * single character (otherwise delivered to everyone) - or a rekey, which every
 * worker applies to its own map.
 *
 * A rekey has to travel the same way a message does. The worker that ran the
 * rebirth is not the one holding the player's socket, so a local mutation there
 * fixes the binding only by coincidence.
 */
type Envelope =
	| {
		to?: number;
		msg: ServerMessage;
	}
	| {
		rekey: { from: number, to: number };
	};

const OPEN = 1;

class WsHub {

	private readonly conns = new Map<number, Set<WSContext>>();
	/** The character each socket currently belongs to. A rebirth moves a socket
	 *  between ids, and the connection that opened it still remembers the id it
	 *  connected with - so this, not the caller, is what says where it lives. */
	private readonly owner = new Map<WSContext, number>();
	private subscribed = false;

	/** Start listening for published messages. Idempotent; called once per worker. */
	public init(): void {
		if (this.subscribed) return;
		this.subscribed = true;

		const sub = redis.duplicate();
		sub.on('error', err => console.error('WS pub/sub error:', err.message));
		void sub.subscribe(CHANNEL);
		sub.on('message', (_channel, payload) => {
			try {
				this.deliver(JSON.parse(payload) as Envelope);
			} catch (err) {
				console.error('WS deliver failed:', (err as Error).message);
			}
		});
	}

	public add(characterId: number, ws: WSContext): void {
		let set = this.conns.get(characterId);
		if (!set) this.conns.set(characterId, set = new Set());
		set.add(ws);
		this.owner.set(ws, characterId);
	}

	/** Move a character's sockets onto a new id, everywhere. A rebirth makes a new
	 *  character and points the account at it; without this, everything addressed
	 *  to the character that is now playing goes to nobody. */
	public rekey(fromId: number, toId: number): void {
		if (fromId === toId) return;
		void redis.publish(CHANNEL, JSON.stringify({
			rekey: {
				from: fromId, to: toId,
			},
		} satisfies Envelope));
	}

	/** The character a socket belongs to now, which is not always the one it
	 *  connected as. */
	public ownerOf(ws: WSContext): number | undefined {
		return this.owner.get(ws);
	}

	public remove(ws: WSContext): void {
		const characterId = this.owner.get(ws);
		this.owner.delete(ws);
		if (characterId === undefined) return;
		const set = this.conns.get(characterId);
		if (!set) return;
		set.delete(ws);
		if (set.size === 0) this.conns.delete(characterId);
	}

	private applyRekey(from: number, to: number): void {
		const set = this.conns.get(from);
		if (!set) return;
		this.conns.delete(from);
		const target = this.conns.get(to);
		if (!target) this.conns.set(to, set);
		else for (const ws of set) target.add(ws);
		for (const ws of set) this.owner.set(ws, to);
	}

	/** Is this character connected to *this* worker? */
	public isLocal(characterId: number): boolean {
		return this.conns.has(characterId);
	}

	/** Deliver to every connected client, everywhere. */
	public broadcast(msg: ServerMessage): void {
		void redis.publish(CHANNEL, JSON.stringify({ msg } satisfies Envelope));
	}

	/** Deliver to one character's clients, wherever they are. */
	public sendTo(characterId: number, msg: ServerMessage): void {
		void redis.publish(CHANNEL, JSON.stringify({
			to: characterId, msg,
		} satisfies Envelope));
	}

	/** Send straight to one socket (no fan-out) - e.g. the initial snapshot. */
	public sendLocal(ws: WSContext, msg: ServerMessage): void {
		if (ws.readyState !== OPEN) return;
		ws.send(JSON.stringify(msg));
	}

	private deliver(envelope: Envelope): void {
		if ('rekey' in envelope) {
			this.applyRekey(envelope.rekey.from, envelope.rekey.to);
			return;
		}
		const { to, msg } = envelope;
		const data = JSON.stringify(msg);
		const sets = to === undefined
			? this.conns.values()
			: [this.conns.get(to)].filter(s => s !== undefined);
		for (const set of sets) {
			for (const ws of set) {
				if (ws.readyState === OPEN) ws.send(data);
			}
		}
	}

}

export const hub = new WsHub();
