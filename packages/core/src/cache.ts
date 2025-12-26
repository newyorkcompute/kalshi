/**
 * TTL Cache
 * 
 * Lightweight in-memory cache with time-to-live expiration.
 * Useful for caching API responses to reduce rate limiting.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Cache storage
const cache = new Map<string, CacheEntry<unknown>>();

// Default TTL: 1 minute
const DEFAULT_TTL = 60 * 1000;

/**
 * Get cached data if not expired
 * 
 * @param key - Cache key
 * @param ttl - Time-to-live in milliseconds (default: 60s)
 * @returns Cached data or null if expired/missing
 * 
 * @example
 * ```ts
 * const data = getCached<Market[]>('markets', 30000);
 * if (!data) {
 *   // Fetch fresh data
 * }
 * ```
 */
export function getCached<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > ttl;
  if (isExpired) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

/**
 * Set cached data with current timestamp
 * 
 * @param key - Cache key
 * @param data - Data to cache
 * 
 * @example
 * ```ts
 * setCache('markets', marketData);
 * ```
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear specific cache entry
 * 
 * @param key - Cache key to clear
 */
export function clearCache(key: string): void {
  cache.delete(key);
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache statistics (for debugging)
 * 
 * @returns Object with cache size and keys
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

/**
 * Common TTL constants for Kalshi data
 */
export const CACHE_TTL = {
  /** 5 minutes - Trade history doesn't change rapidly */
  PRICE_HISTORY: 5 * 60 * 1000,
  /** 10 minutes - Market titles/close times rarely change */
  MARKET_METADATA: 10 * 60 * 1000,
  /** 1 minute - Events list */
  EVENTS: 60 * 1000,
  /** No cache - Orderbook needs real-time data */
  ORDERBOOK: 0,
  /** No cache - Balance needs real-time data */
  BALANCE: 0,
  /** No cache - Positions need real-time data */
  POSITIONS: 0,
} as const;

