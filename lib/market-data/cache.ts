type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number;
};

type CacheStore = Map<string, CacheEntry<unknown>>;
type InflightStore = Map<string, Promise<unknown>>;

declare global {
  // eslint-disable-next-line no-var
  var __portfolioMarketDataCache__: CacheStore | undefined;
  // eslint-disable-next-line no-var
  var __portfolioMarketDataInflight__: InflightStore | undefined;
}

function getCacheStore(): CacheStore {
  if (!globalThis.__portfolioMarketDataCache__) {
    globalThis.__portfolioMarketDataCache__ = new Map();
  }

  return globalThis.__portfolioMarketDataCache__;
}

function getInflightStore(): InflightStore {
  if (!globalThis.__portfolioMarketDataInflight__) {
    globalThis.__portfolioMarketDataInflight__ = new Map();
  }

  return globalThis.__portfolioMarketDataInflight__;
}

export interface CachePolicy {
  ttlMs: number;
  staleOnErrorMs?: number;
}

export function getCachedValue<T>(key: string): T | null {
  const entry = getCacheStore().get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    return null;
  }

  return entry.value;
}

function getStaleValue<T>(key: string): T | null {
  const entry = getCacheStore().get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    return null;
  }

  if (Date.now() > entry.staleUntil) {
    getCacheStore().delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue<T>(key: string, value: T, policy: CachePolicy) {
  const now = Date.now();
  getCacheStore().set(key, {
    value,
    expiresAt: now + policy.ttlMs,
    staleUntil: now + policy.ttlMs + (policy.staleOnErrorMs ?? 0)
  });
}

export async function getOrSetCached<T>(key: string, policy: CachePolicy, loader: () => Promise<T>): Promise<T> {
  const fresh = getCachedValue<T>(key);
  if (fresh !== null) {
    return fresh;
  }

  const inflightStore = getInflightStore();
  const existingInflight = inflightStore.get(key) as Promise<T> | undefined;
  if (existingInflight) {
    return existingInflight;
  }

  const pending = (async () => {
    try {
      const value = await loader();
      setCachedValue(key, value, policy);
      return value;
    } catch (error) {
      const stale = getStaleValue<T>(key);
      if (stale !== null) {
        return stale;
      }

      throw error;
    } finally {
      inflightStore.delete(key);
    }
  })();

  inflightStore.set(key, pending);
  return pending;
}

