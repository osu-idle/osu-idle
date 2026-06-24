import type { Context } from 'hono';
import {
	env,
	isProd,
} from '../env';
import { publish } from './publish';

// Discord caps a field value at 1024 chars; keep room for the code fence.
const trim = (text: string, max = 1000) =>
	text.length > max ? `${text.slice(0, max)}…` : text;

/**
 * Report an unhandled server error to the Discord error feed. Best-effort: the
 * publish itself swallows failures, and we never report in dev (no live webhook
 * worth spamming) - the console.error in onError still fires there.
 */
export const reportError = (err: Error, c: Context) => {
	if (!isProd || !env.ERROR_FEED_WEBHOOK) return;

	void publish(env.ERROR_FEED_WEBHOOK, {
		embeds: [{
			title: trim(err.message || err.name, 256),
			description: `\`${c.req.method} ${c.req.path}\``,
			color: 15548997,
			fields: err.stack ? [{
				name: 'Stack',
				value: `\`\`\`\n${trim(err.stack)}\n\`\`\``,
			}] : [],
			timestamp: new Date().toISOString(),
		}],
	});
};
