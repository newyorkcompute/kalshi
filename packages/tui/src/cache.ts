/**
 * Simple TTL Cache
 * Lightweight caching for API responses
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
 * Set cached data with timestamp
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear specific cache entry
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
 * Get cache stats (for debugging)
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

// Cache TTL constants
export const CACHE_TTL = {
  PRICE_HISTORY: 5 * 60 * 1000,  // 5 minutes - trade history doesn't change rapidly
  MARKET_META: 10 * 60 * 1000,   // 10 minutes - titles/close times rarely change
  ORDERBOOK: 0,                   // No cache - always fresh
  BALANCE: 0,                     // No cache - always fresh
} as const;

