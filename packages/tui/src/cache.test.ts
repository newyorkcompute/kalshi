import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCached,
  setCache,
  clearCache,
  clearAllCache,
  getCacheStats,
} from './cache.js';

describe('cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setCache and getCached', () => {
    it('stores and retrieves data', () => {
      const data = { foo: 'bar' };
      setCache('test-key', data);
      
      const result = getCached<typeof data>('test-key');
      expect(result).toEqual(data);
    });

    it('returns null for non-existent keys', () => {
      const result = getCached('non-existent');
      expect(result).toBeNull();
    });

    it('returns null for expired entries', () => {
      setCache('test-key', { foo: 'bar' });
      
      // Advance time past default TTL (60s)
      vi.advanceTimersByTime(61 * 1000);
      
      const result = getCached('test-key');
      expect(result).toBeNull();
    });

    it('returns data within TTL', () => {
      setCache('test-key', { foo: 'bar' });
      
      // Advance time but stay within TTL
      vi.advanceTimersByTime(30 * 1000);
      
      const result = getCached('test-key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('respects custom TTL', () => {
      setCache('test-key', { foo: 'bar' });
      
      // Custom TTL of 10 seconds
      vi.advanceTimersByTime(11 * 1000);
      
      const result = getCached('test-key', 10 * 1000);
      expect(result).toBeNull();
    });
  });

  describe('clearCache', () => {
    it('clears specific entry', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      
      clearCache('key1');
      
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBe('value2');
    });
  });

  describe('clearAllCache', () => {
    it('clears all entries', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      
      clearAllCache();
      
      expect(getCached('key1')).toBeNull();
      expect(getCached('key2')).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('returns cache statistics', () => {
      setCache('key1', 'value1');
      setCache('key2', 'value2');
      
      const stats = getCacheStats();
      
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });
});

