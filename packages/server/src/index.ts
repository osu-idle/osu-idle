import { serve } from '@hono/node-server';
import { appendFile } from 'node:fs/promises';
import Logfile from '@osu-idle/shared/helpers/logfile';
import { app } from './app';
import { port } from './env';
import { redis } from './redis';
import { sweepDuePlays } from './play';
import { sweepRankedMaps } from './beatmaps/sweep';
import { ensureRankings } from './rankings';

Logfile.setWriter(lines => appendFile('runtime.log', lines.join('\n') + '\n'));

const server = serve({
	fetch: app.fetch, port, 
}, info => {
	console.log(`🎵 osu! idle API listening on http://localhost:${info.port}`);
});

// Build the Redis ranking index from MySQL once per deploy (one cluster worker
// wins the lock; the rest return immediately).
void ensureRankings();

// Finalise plays whose end time has passed even if no client ever returns to
// finish them - the server is authoritative. Safe on every worker: the atomic
// claim in finalizePlay guarantees a single submit.
const sweep = setInterval(() => void sweepDuePlays(), 3_000);
sweep.unref();

// Announce scheduled maps whose rank time has passed (no redeploy needed).
const rankSweep = setInterval(() => void sweepRankedMaps(), 30_000);
rankSweep.unref();

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
