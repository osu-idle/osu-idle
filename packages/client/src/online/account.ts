import Synced from '@osu-idle/shared/helpers/synced';
import Log, { POPUP_TYPE } from '@osu-idle/shared/helpers/log';
import sleep from '@osu-idle/shared/helpers/sleep';
import type { CharacterDTO } from '@osu-idle/shared/character';
import { rpc } from './client';
import Auth from './auth';
import Entities from '../entity/entities';
import { isWebOpen } from '../globals';
import Character from '../db/schema/character';

/** Give a single validation attempt this long before declaring us offline. */
const VALIDATE_TIMEOUT_MS = 15_000;
/** Spacing between background reconnect attempts once we've gone offline. */
const RECONNECT_INTERVAL_MS = 5_000;

/** localStorage key the login popup writes to signal the session changed. */
const AUTH_PING_KEY = 'osu-idle:auth';

/**
 * The signed-in account's server-side character, created during first-login
 * onboarding. The local sql.js character stays the live store (this is a
 * one-time snapshot import); `character === null` while logged in means the
 * account still needs onboarding.
 */
export default class Account {

	public static readonly character = new Synced<CharacterDTO | null>(null);
	public static readonly needsOnboarding = new Synced(false);
	/**
	 * False until the session has been validated against the API at least once
	 * (success or, after {@link VALIDATE_TIMEOUT_MS}, a timeout). While false
	 * we're "still validating" - the live character stays the placeholder and
	 * {@link ready} blocks play, so a freshly-booted client never scores as guest
	 * with a session still in flight.
	 */
	public static readonly resolved = new Synced(false);
	/**
	 * Whether we're currently connected to the API. Drops to false when a
	 * validation attempt times out (we then play offline as guest and reconnect
	 * in the background); back to true once the server answers again.
	 */
	public static readonly online = new Synced(true);

	private static initialized = false;
	public static init() {
		if (this.initialized) return;
		this.initialized = true;

		// Drive the live character off the *resolved* session. Until validation
		// answers we leave the placeholder in place - we must neither present a
		// guest nor a stale account before online auth has confirmed who we are.
		void Synced.all([Account.character, Account.resolved], async ([dto, resolved]) => {
			if (dto) {
				// Make sure the dto exists in the local db for score assignment.
				const existing = await Character.get(dto.id);
				const character = Character.fromDTO(dto);
				if (existing) character.update();
				else character.add();
				Entities.character.set(character);
				return;
			}
			// No account character: fall back to guest only once we KNOW we're
			// signed out. While still validating, keep the loading character.
			if (resolved) Entities.character.set(await Character.guest());
		});
	}

	/**
	 * Resolves once the session has been validated at least once. Play start
	 * awaits this so a play launched right after boot waits for the real
	 * character instead of being scored as guest mid-validation.
	 */
	public static ready(): Promise<void> {
		if (Account.resolved.get()) return Promise.resolve();
		return new Promise<void>(resolve => {
			const cb = (v: boolean) => {
				if (!v) return;
				Account.resolved.desync(cb);
				resolve();
			};
			void Account.resolved.sync(cb);
		});
	}

	/** Onboard: create the account's character. Always fresh - local Guest
	 *  progress is no longer migrated online. */
	public static async complete(opts: { name: string }): Promise<void> {
		const res = await rpc.v1.me.character.$post({ json: { name: opts.name } });
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw new Error(`onboarding failed (${res.status})${detail ? `: ${detail}` : ''}`);
		}

		const characterDTO = await res.json();
		await Account.needsOnboarding.set(false);
		await Account.character.set(characterDTO);
	}
}

/**
 * One bounded attempt to validate the session against the API. Resolves the user
 * and (if signed in) their character, committing both atomically so the UI never
 * shows a half-resolved state. Returns true if the server answered (signed in or
 * out), false if it couldn't be reached within {@link VALIDATE_TIMEOUT_MS}.
 *
 * The timeout is what bounds us: API.fetch retries transient failures (network
 * errors, 5xx) indefinitely, but it surfaces an intentional abort - so a downed
 * or restarting server trips the timeout here instead of hanging forever.
 */
async function probeSession(): Promise<boolean> {
	try {
		const signal = AbortSignal.timeout(VALIDATE_TIMEOUT_MS);
		const meRes = await rpc.v1.auth.me.$get(undefined, { init: { signal } });
		const user = meRes.ok ? await meRes.json() : null;

		let character: CharacterDTO | null = null;
		if (user) {
			const charRes = await rpc.v1.me.character.$get(undefined, { init: { signal } });
			character = charRes.ok ? await charRes.json() : null;
		}

		// Commit only once both calls have answered, so the avatar (user) and the
		// live character can never momentarily disagree.
		Auth.user.set(user);
		Account.character.set(character);
		Account.needsOnboarding.set(user !== null && character === null);
		return true;
	} catch (e) {
		// Timed out / aborted → the server is unreachable right now.
		Log.errorPopup(`Failed to synchronize character ${e}`);
		console.error(e);
		return false;
	}
}

/** Mark us online, announcing recovery only on the offline→online edge. */
async function goOnline(): Promise<void> {
	if (!Account.online.get()) Log.popup('Back online.', POPUP_TYPE.good);
	await Account.online.set(true);
}

/** Mark us offline, announcing it only on the online→offline edge. The message
 *  differs depending on whether we had a session to begin with: a fresh boot
 *  falls back to guest, an established session is just temporarily unreachable
 *  (we keep it rather than dropping to guest over a blip). */
async function goOffline(): Promise<void> {
	if (Account.online.get()) {
		Log.errorPopup(Auth.user.get()
			? 'Connection lost - reconnecting…'
			: 'Disconnected from server - playing offline as Guest.');
	}
	await Account.online.set(false);
}

/**
 * Validate the session, bounded so a down/restarting server can't hang the
 * client. On success we're online with the real character; on a timeout we settle
 * as guest (offline) and keep retrying in the background until the server returns.
 */
async function syncSession(fromLogin = false): Promise<void> {
	const ok = await probeSession();
	await Account.resolved.set(true); // we now have a character to use (account or guest)

	if (ok) {
		await goOnline();
		// On a fresh login, drop the in-game browser to return the player to the game.
		if (fromLogin && Auth.user.get()) isWebOpen.set(false);
		return;
	}

	await goOffline();
	void reconnectLoop();
}

let reconnecting = false;

/**
 * After a disconnect, keep probing in the background; the moment the server
 * answers again, restore the real session (which swaps the guest character back
 * to the account in the UI) and announce it.
 */
async function reconnectLoop(): Promise<void> {
	if (reconnecting) return; // a loop is already running
	reconnecting = true;
	try {
		while (!Account.online.get()) {
			await sleep(RECONNECT_INTERVAL_MS);
			if (await probeSession()) await goOnline();
		}
	} finally {
		reconnecting = false;
	}
}

/**
 * Tie the in-game browser (web) session to the client's. The web platform runs
 * in a same-origin iframe and authenticates off the same HttpOnly cookie, so the
 * source of truth is shared - but its cached view can drift. Whenever our
 * resolved user identity changes we ping localStorage, which the web iframe (and
 * any other tab) listens for to re-read the session. Guarded on the user id so a
 * re-validation landing on the same account doesn't loop the ping back and forth.
 */
let lastBroadcastUserId: number | null = Auth.user.get()?.id ?? null;
void Auth.user.sync(user => {
	const id = user?.id ?? null;
	if (id === lastBroadcastUserId) return;
	lastBroadcastUserId = id;
	try { localStorage.setItem(AUTH_PING_KEY, String(Date.now())); } catch { /* ignore */ }
});

// Resolve on boot.
void syncSession();

// The login/logout flows (and the broadcast above, from another tab) write
// AUTH_PING_KEY; the same-origin `storage` event re-resolves our session so the
// client and the web platform never disagree on who's signed in.
window.addEventListener('storage', e => {
	if (e.key === AUTH_PING_KEY) void syncSession(true);
});

Account.init();