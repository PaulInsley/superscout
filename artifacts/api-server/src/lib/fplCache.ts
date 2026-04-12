interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttl: number;
}

type CacheKey = string;

const cache = new Map<CacheKey, CacheEntry<unknown>>();

const TTL = {
  STATIC: 6 * 60 * 60 * 1000,
  SEMI_LIVE: 30 * 60 * 1000,
  SEMI_LIVE_ACTIVE: 2 * 60 * 1000,
  USER: 2 * 60 * 1000,
};

let liveMatchActive = false;

export function setLiveMatchActive(active: boolean): void {
  liveMatchActive = active;
}

export function isLiveMatchActive(): boolean {
  return liveMatchActive;
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.fetchedAt > entry.ttl;
}

export function getCached<T>(key: CacheKey): { data: T; fetchedAt: number } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (isExpired(entry)) return null;
  return { data: entry.data, fetchedAt: entry.fetchedAt };
}

export function getStale<T>(key: CacheKey): { data: T; fetchedAt: number } | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  return { data: entry.data, fetchedAt: entry.fetchedAt };
}

export function setCache<T>(key: CacheKey, data: T, ttl: number): void {
  cache.set(key, { data, fetchedAt: Date.now(), ttl });
}

export function clearCache(key?: CacheKey): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function getCacheAge(key: CacheKey): number | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return Date.now() - entry.fetchedAt;
}

export function cacheKey(endpoint: string, ...params: (string | number)[]): string {
  return [endpoint, ...params].join(":");
}

export { TTL };
