// Keep mobile devices from dimming/sleeping while the game client is open.
// The Screen Wake Lock is automatically released by the OS whenever the page
// loses visibility, so we re-acquire it every time we become visible again.

let sentinel: WakeLockSentinel | null = null;

// Acquire (or re-acquire) the screen wake lock. iOS requires this to be reached
// from a user gesture the first time, so kick it off from the intro tap.
export async function acquireWakeLock() {
	if (!('wakeLock' in navigator)) return;
	if (document.visibilityState !== 'visible') return;
	if (sentinel) return;

	try {
		sentinel = await navigator.wakeLock.request('screen');
		sentinel.addEventListener('release', () => {
			sentinel = null;
		});
	} catch {
		// Request can reject (e.g. low battery, no user activation yet); retry later.
		sentinel = null;
	}
}

let initialized = false;
export function initWakeLock() {
	if (initialized) return;
	initialized = true;

	// The OS releases the lock whenever we lose visibility; re-acquire on return.
	document.addEventListener('visibilitychange', () => void acquireWakeLock());
}
