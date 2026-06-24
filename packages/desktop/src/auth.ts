import {
	app,
	safeStorage,
	shell,
} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { API_BASE } from './config';
import { broadcast } from './frames';

/**
 * Desktop session handling. The osu! OAuth round-trip runs in the user's real
 * system browser (trusted chrome, password managers, no embedded-webview
 * friction). We can't receive a browser cookie or a custom-scheme deep link
 * (some browsers block those), so the app generates a one-time poll code, hands
 * it to the server in the OAuth state, and polls until the server has stashed
 * the session under it. The token is then held here (encrypted on disk via
 * {@link safeStorage}) and pushed to every renderer frame, which sends it as a
 * `Bearer` header on each API call.
 */

const LOGIN_TIMEOUT_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 1500;

let token: string | null = null;
// Identifies the in-flight login so a newer one supersedes any older poll loop.
let activeLogin: string | null = null;

const tokenFile = () => path.join(app.getPath('userData'), 'session.bin');

/** Load any persisted session at startup. */
export function loadToken(): void {
	try {
		const buf = fs.readFileSync(tokenFile());
		token = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
	} catch {
		token = null;
	}
}

function persist(): void {
	try {
		if (token === null) {
			fs.rmSync(tokenFile(), { force: true });
			return;
		}
		const buf = safeStorage.isEncryptionAvailable()
			? safeStorage.encryptString(token)
			: Buffer.from(token, 'utf8');
		fs.writeFileSync(tokenFile(), buf);
	} catch (e) {
		console.error('[auth] failed to persist session', e);
	}
}

export function getToken(): string | null {
	return token;
}

function setToken(next: string | null): void {
	token = next;
	persist();
	// push to every frame (top + the /web iframe) so each bridge - and its API
	// client - switches identity.
	broadcast('osu-idle:auth-token', token);
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Try to redeem the poll code for the session token. Null while the server
 *  hasn't stashed it yet (the user is still signing in) - the caller polls. */
async function tryRedeem(poll: string): Promise<string | null> {
	try {
		const res = await fetch(`${API_BASE}/v1/auth/osu/desktop/exchange`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code: poll }),
		});
		if (!res.ok) return null;
		const { token: fresh } = await res.json() as { token: string };
		return fresh;
	} catch {
		return null;
	}
}

/** Begin sign-in: open the system browser to the OAuth flow with a one-time poll
 *  code, then poll the server until it has stashed the session under that code
 *  (the browser can't deliver a cookie or deep link back to us). */
export async function startLogin(): Promise<void> {
	const poll = randomUUID();
	activeLogin = poll;
	void shell.openExternal(`${API_BASE}/v1/auth/osu/login?client=desktop&poll=${poll}`);

	const deadline = Date.now() + LOGIN_TIMEOUT_MS;
	while (Date.now() < deadline) {
		await delay(POLL_INTERVAL_MS);
		if (activeLogin !== poll) return; // superseded by a newer login
		const fresh = await tryRedeem(poll);
		if (fresh) {
			if (activeLogin === poll) {
				activeLogin = null;
				setToken(fresh);
			}
			return;
		}
	}
	if (activeLogin === poll) activeLogin = null;
	throw new Error('login timed out');
}

export function logout(): void {
	activeLogin = null;
	setToken(null);
}
