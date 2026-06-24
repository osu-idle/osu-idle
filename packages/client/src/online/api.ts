import sleep from '@osu-idle/shared/helpers/sleep';

/** First retry delay, doubled each attempt up to {@link RETRY_MAX_MS}. */
const RETRY_BASE_MS = 1_000;
/**
 * Backoff ceiling. Kept low so a server that's down or restarting is re-probed
 * every few seconds and the client recovers right after it comes back - rather
 * than the session appearing lost over a brief outage. Transient failures retry
 * indefinitely (they must not surface to callers, which would drop us to guest)
 */
const RETRY_MAX_MS = 15_000;

/**
 * Thin fetch wrapper with retry/backoff. It does NOT rewrite URLs - local asset
 * requests stay on the client origin, and backend calls get their base URL from
 * the RPC client (see online/client.ts, which builds full URLs via `hc`).
 *
 * Only transient failures are retried (network errors and 5xx). 2xx/3xx/4xx are
 * returned to the caller - a 4xx like 401/403/404 is a real answer, not
 * something to hammer.
 */
export default class API {

	public static async fetch(
		input: RequestInfo | URL,
		init?: RequestInit,
	): ReturnType<typeof fetch> {
		let attempt = 0;
		do {
			try {
				const res = await fetch(input, init);
				if (res.status >= 500) throw new Error(`${res.status}: ${await res.text()}`);
				return res;
			} catch(e) {
				// An intentional abort (e.g. a bounded session probe timing out) is not
				// transient - surface it instead of retrying against a dead signal.
				if (
					init?.signal?.aborted 
				|| (e instanceof DOMException && e.name === 'AbortError')
				) throw e;
				console.error(e);
				// Capped exponential backoff: 1s, 2s, 4s, 8s, then 15s steady.
				await sleep(Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS));
				attempt++;
			}
		} while(true);
	}

}
