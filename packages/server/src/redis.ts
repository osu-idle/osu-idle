import { Redis } from 'ioredis';
import {
	env,
	redisDb,
} from './env';

/**
 * Shared Redis connection. It holds the play state that used to live in
 * process memory (pending plays, online/playing presence, per-character session
 * strain), so every worker in a pm2 cluster sees the same state and a play that
 * starts on one worker can be completed on another.
 *
 * One connection per worker process; ioredis multiplexes all commands over it
 * and reconnects on its own. Persistence (surviving reboots) is Redis's job -
 * enable AOF (`appendonly yes`, `appendfsync everysec`) on the server.
 */
export const redis = new Redis({
	host: env.REDIS_HOST,
	port: env.REDIS_PORT,
	password: env.REDIS_PASSWORD,
	db: redisDb,
	// Don't let a momentary Redis outage turn into unbounded command queues.
	maxRetriesPerRequest: 3,
});

// Log connection errors instead of crashing the worker - a request that needs
// Redis while it's down will reject and surface as a 500, same as the DB.
redis.on('error', err => console.error('Redis error:', err.message));
