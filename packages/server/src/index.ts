import { serve } from '@hono/node-server';
import { appendFile } from 'node:fs/promises';
import Logfile from '@osu-idle/shared/helpers/logfile';
import { app } from './app';
import { port } from './env';
import { redis } from './redis';

Logfile.setWriter(lines => appendFile('runtime.log', lines.join('\n') + '\n'));

const server = serve({ fetch: app.fetch, port }, info => {
	console.log(`🎵 osu! idle API listening on http://localhost:${info.port}`);
});

/**
 * Drain on a clean shutdown (systemd stop / restart, Ctrl-C, tsx-watch reload,
 * pm2 reload). In-flight plays now live in Redis, so there's nothing to snapshot
 * here - just close the HTTP server and the Redis connection.
 */
function shutdown(signal: string): void {
	console.log(`\n${signal} received - shutting down.`);
	redis.quit();
	server.close(() => process.exit(0));
	// Don't hang forever if a connection refuses to drain.
	setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
