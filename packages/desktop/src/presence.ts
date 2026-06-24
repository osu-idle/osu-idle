import net from 'node:net';
import { randomUUID } from 'node:crypto';
// eslint-disable-next-line @stylistic/max-len
import type { DesktopPresence } from '@osu-idle/shared/desktop' with { 'resolution-mode': 'import' };
import {
	DISCORD_CLIENT_ID,
	DISCORD_LARGE_IMAGE,
} from './config';

/**
 * Discord Rich Presence over Discord's local IPC socket - no dependency, just
 * the documented framing (two little-endian int32s: opcode + length, then a JSON
 * body). Self-healing: it connects lazily, remembers the last presence the
 * renderer pushed, and reconnects on its own when Discord is started/restarted,
 * so the renderer can fire-and-forget {@link setPresence} without caring whether
 * Discord is up. Inert when no {@link DISCORD_CLIENT_ID} was built in.
 */

const OP_HANDSHAKE = 0;
const OP_FRAME = 1;
const OP_CLOSE = 2;
const RECONNECT_MS = 15_000;

let socket: net.Socket | null = null;
let connected = false;       // handshake acked, safe to send activity
let reconnectTimer: NodeJS.Timeout | null = null;
let pending: DesktopPresence | null = null;   // last presence the renderer asked for

/** Candidate IPC socket paths, in order Discord may have opened one (it numbers
 *  them 0-9 and Flatpak/Snap nest them under their own runtime dirs). */
function socketPaths(): string[] {
	if (process.platform === 'win32') {
		return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
	}
	const base = process.env.XDG_RUNTIME_DIR
		|| process.env.TMPDIR 
		|| process.env.TMP 
		|| process.env.TEMP 
		|| '/tmp'
	;
	const dirs = ['', 'app/com.discordapp.Discord/', 'snap.discord/'];
	return dirs.flatMap(dir => Array.from({ length: 10 }, (_, i) => `${base}/${dir}discord-ipc-${i}`));
}

function encode(opcode: number, payload: unknown): Buffer {
	const body = Buffer.from(JSON.stringify(payload), 'utf8');
	const header = Buffer.alloc(8);
	header.writeInt32LE(opcode, 0);
	header.writeInt32LE(body.length, 4);
	return Buffer.concat([header, body]);
}

/** Map our renderer-facing presence onto Discord's activity shape and send it. */
function sendActivity(): void {
	if (!socket || !connected) return;
	const activity = pending && {
		details: pending.details,
		state: pending.state,
		timestamps: pending.startedAt ? { start: pending.startedAt } : undefined,
		assets: {
			large_image: DISCORD_LARGE_IMAGE,
			small_image: pending.smallImage,
		},
	};
	socket.write(encode(OP_FRAME, {
		cmd: 'SET_ACTIVITY',
		args: {
			pid: process.pid, activity, 
		},
		nonce: randomUUID(),
	}));
}

function scheduleReconnect(): void {
	if (reconnectTimer || !DISCORD_CLIENT_ID) return;
	reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(0); }, RECONNECT_MS);
}

function teardown(): void {
	connected = false;
	if (socket) { socket.removeAllListeners(); socket.destroy(); socket = null; }
}

/** Try the IPC sockets one after another; on the first that connects, handshake.
 *  When none answer (Discord not running), back off and retry later. */
function connect(index: number): void {
	const paths = socketPaths();
	if (index >= paths.length) { scheduleReconnect(); return; }

	const sock = net.createConnection(paths[index]);
	sock.once('error', () => { sock.destroy(); connect(index + 1); });
	sock.once('connect', () => {
		socket = sock;
		sock.on('error', () => { teardown(); scheduleReconnect(); });
		sock.on('close', () => { teardown(); scheduleReconnect(); });
		// the first frame Discord sends back is the READY dispatch - treat any reply
		// as "handshake accepted" and flush whatever presence is pending.
		sock.once('data', () => { connected = true; sendActivity(); });
		sock.write(encode(OP_HANDSHAKE, {
			v: 1, client_id: DISCORD_CLIENT_ID, 
		}));
	});
}

/** Start the presence client. No-op without a configured Discord client id. */
export function initPresence(): void {
	if (!DISCORD_CLIENT_ID) return;
	connect(0);
}

/** Push the latest presence (or null to clear). Buffered until Discord connects. */
export function setPresence(presence: DesktopPresence | null): void {
	if (!DISCORD_CLIENT_ID) return;
	pending = presence;
	sendActivity();
}

/** Cleanly clear presence and close the socket on quit. */
export function destroyPresence(): void {
	if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
	if (socket && connected) socket.write(encode(OP_CLOSE, {}));
	teardown();
}
