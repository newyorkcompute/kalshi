/**
 * Cache Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getCached,
  setCache,
  clearCache,
  clearAllCache,
  getCacheStats,
  CACHE_TTL,
} from './cache.js';

describe('cache', () => {
  beforeEach(() => {
    clearAllCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setCache and getCached', () => {
    it('should store and retrieve data', () => {
      const data = { ticker: 'KXBTC', price: 50 };
      setCache('market-1', data);
      
      const result = getCached<typeof data>('market-1');
      expect(result).toEqual(data);
    });

    it('should return null for non-existent key', () => {
      const result = getCached('non-existent');
      expect(result).toBeNull();
    });

    it('should return null after TTL expires', () => {
      const data = { value: 42 };
      setCache('test-key', data);
      
      // Advance time past default TTL (60s)
      vi.advanceTimersByTime(61 * 1000);
      
      const result = getCached('test-key');
      expect(result).toBeNull();
    });

    it('should return data before TTL expires', () => {
      const data = { value: 42 };
      setCache('test-key', data);
      
      // Advance time but stay within TTL
      vi.advanceTimersByTime(30 * 1000);
      
      const result = getCached('test-key');
      expect(result).toEqual(data);
    });

    it('should respect custom TTL', () => {
      const data = { value: 'test' };
      const customTTL = 5000; // 5 seconds
      
      setCache('custom-ttl', data);
      
      // Still valid at 4 seconds
      vi.advanceTimersByTime(4000);
      expect(getCached('custom-ttl', customTTL)).toEqual(data);
      
      // Expired at 6 seconds
      vi.advanceTimersByTime(2000);
      expect(getCached('custom-ttl', customTTL)).toBeNull();
    });

    it('should overwrite existing cache entry', () => {
      setCache('key', { v: 1 });
      setCache('key', { v: 2 });
      
      const result = getCached<{ v: number }>('key');
      expect(result).toEqual({ v: 2 });
    });
  });

  describe('clearCache', () => {
    it('should clear specific cache entry', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      
      clearCache('key1');
      
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBe('value2');
    });

    it('should handle clearing non-existent key', () => {
      expect(() => clearCache('non-existent')).not.toThrow();
    });
  });

  describe('clearAllCache', () => {
    it('should clear all cache entries', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      setCache('key3', 'value3');
      
      clearAllCache();
      
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBeNull();
      expect(getCached('key3')).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      
      const stats = getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });

    it('should return empty stats for empty cache', () => {
      const stats = getCacheStats();
      
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });
  });

  describe('CACHE_TTL constants', () => {
    it('should have expected TTL values', () => {
      expect(CACHE_TTL.PRICE_HISTORY).toBe(5 * 60 * 1000);
      expect(CACHE_TTL.MARKET_METADATA).toBe(10 * 60 * 1000);
      expect(CACHE_TTL.EVENTS).toBe(60 * 1000);
      expect(CACHE_TTL.ORDERBOOK).toBe(0);
      expect(CACHE_TTL.BALANCE).toBe(0);
      expect(CACHE_TTL.POSITIONS).toBe(0);
    });
  });
});

