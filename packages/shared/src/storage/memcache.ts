import { deferred } from '../helpers/deferred.js';
import uuid from '../math/uuid.js';

const global = uuid();

class CacheStore<V> extends Map<string | number, V> {

	/** key;ends in ms */
	private killMap = new Map<string | number, number>();

	constructor() {
		super();
		setInterval(() => {
			for (const key of this.killMap.keys()) {
				this.checkKill(key);
			}
		}, 60000);
	}

	private processLock = new Map<string | number | null, Promise<V>>();
	async process(
		key: string | number | null, processor: () => V | Promise<V>,
		ttl?: number,
	): Promise<V> {
		key = key ?? global;
		const existing = this.get(key);
		if (existing) return existing;
		const lock = this.processLock.get(key);
		if (lock) return lock;
		const { promise, resolve } = deferred<V>();
		this.processLock.set(key, promise);
		const result = await processor();
		this.save(key, result, ttl);
		this.processLock.delete(key);
		resolve(result);
		return promise;
	}

	processSync(key: string | number | null, processor: () => V, ttl?: number): V {
		return this.get(key ?? global) ?? this.save(key ?? global, processor(), ttl);
	}

	save(key: string | number, value: V, ttl?: number): V {
		this.set(key, value);
		if (ttl) {
			this.killMap.set(key, Date.now() + ttl);
		}
		return value;
	}

	get(key: string | number | null): V | undefined {
		if (this.checkKill(key ?? global)) return;
		return super.get(key ?? global);
	}
	
	private checkKill(key: string | number) {
		const ends = this.killMap.get(key);
		if (ends && Date.now() > ends) {
			this.delete(key);
			return true;
		}
		return false;
	}
}

export default class MemCache {

	private static caches: Map<string, CacheStore<unknown>> = new Map();

	static get<T>(name?: string): CacheStore<T> {
		name = name ?? uuid();
		if (!this.caches.has(name)) {
			this.caches.set(name, new CacheStore<T>());
		}
		return this.caches.get(name) as CacheStore<T>;
	}
}