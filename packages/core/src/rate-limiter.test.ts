/**
 * Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  createRateLimiter,
  isRateLimitError,
} from './rate-limiter.js';

describe('createRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should not block requests initially', () => {
      const limiter = createRateLimiter();
      expect(limiter.shouldBlock()).toBe(false);
    });

    it('should have minimum interval initially', () => {
      const limiter = createRateLimiter({ minInterval: 1000 });
      expect(limiter.getCurrentInterval()).toBe(1000);
    });

    it('should have correct initial state', () => {
      const limiter = createRateLimiter();
      const state = limiter.getState();
      
      expect(state.consecutiveFailures).toBe(0);
      expect(state.isCircuitOpen).toBe(false);
      expect(state.isRateLimited).toBe(false);
    });
  });

  describe('recordSuccess', () => {
    it('should reset consecutive failures', () => {
      const limiter = createRateLimiter();
      
      limiter.recordFailure();
      limiter.recordFailure();
      expect(limiter.getState().consecutiveFailures).toBe(2);
      
      limiter.recordSuccess();
      expect(limiter.getState().consecutiveFailures).toBe(0);
    });

    it('should reset interval to minimum', () => {
      const limiter = createRateLimiter({ minInterval: 1000 });
      
      limiter.recordRateLimitError();
      expect(limiter.getCurrentInterval()).toBeGreaterThan(1000);
      
      limiter.recordSuccess();
      expect(limiter.getCurrentInterval()).toBe(1000);
    });

    it('should clear rate limited flag', () => {
      const limiter = createRateLimiter();
      
      limiter.recordRateLimitError();
      expect(limiter.getState().isRateLimited).toBe(true);
      
      limiter.recordSuccess();
      expect(limiter.getState().isRateLimited).toBe(false);
    });
  });

  describe('recordRateLimitError', () => {
    it('should increase interval with exponential backoff', () => {
      const limiter = createRateLimiter({
        minInterval: 1000,
        backoffMultiplier: 2,
      });
      
      limiter.recordRateLimitError();
      expect(limiter.getCurrentInterval()).toBe(2000);
      
      limiter.recordRateLimitError();
      expect(limiter.getCurrentInterval()).toBe(4000);
      
      limiter.recordRateLimitError();
      expect(limiter.getCurrentInterval()).toBe(8000);
    });

    it('should not exceed max interval', () => {
      const limiter = createRateLimiter({
        minInterval: 1000,
        maxInterval: 5000,
        backoffMultiplier: 2,
      });
      
      // 1000 -> 2000 -> 4000 -> 5000 (capped)
      limiter.recordRateLimitError();
      limiter.recordRateLimitError();
      limiter.recordRateLimitError();
      limiter.recordRateLimitError();
      
      expect(limiter.getCurrentInterval()).toBe(5000);
    });

    it('should set rate limited flag', () => {
      const limiter = createRateLimiter();
      
      limiter.recordRateLimitError();
      expect(limiter.getState().isRateLimited).toBe(true);
    });

    it('should increment consecutive failures', () => {
      const limiter = createRateLimiter();
      
      limiter.recordRateLimitError();
      expect(limiter.getState().consecutiveFailures).toBe(1);
      
      limiter.recordRateLimitError();
      expect(limiter.getState().consecutiveFailures).toBe(2);
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after threshold failures', () => {
      const limiter = createRateLimiter({
        circuitBreakerThreshold: 3,
      });
      
      limiter.recordFailure();
      limiter.recordFailure();
      expect(limiter.shouldBlock()).toBe(false);
      
      limiter.recordFailure();
      expect(limiter.shouldBlock()).toBe(true);
    });

    it('should reset circuit after timeout', () => {
      const limiter = createRateLimiter({
        circuitBreakerThreshold: 2,
        circuitResetTimeout: 5000,
      });
      
      limiter.recordFailure();
      limiter.recordFailure();
      expect(limiter.shouldBlock()).toBe(true);
      
      // Advance time past reset timeout
      vi.advanceTimersByTime(5001);
      
      expect(limiter.shouldBlock()).toBe(false);
      expect(limiter.getState().consecutiveFailures).toBe(0);
    });

    it('should close circuit on success', () => {
      const limiter = createRateLimiter({
        circuitBreakerThreshold: 2,
      });
      
      limiter.recordFailure();
      limiter.recordFailure();
      expect(limiter.shouldBlock()).toBe(true);
      
      limiter.recordSuccess();
      expect(limiter.shouldBlock()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const limiter = createRateLimiter({
        minInterval: 1000,
        circuitBreakerThreshold: 2,
      });
      
      limiter.recordRateLimitError();
      limiter.recordRateLimitError();
      expect(limiter.shouldBlock()).toBe(true);
      expect(limiter.getCurrentInterval()).toBeGreaterThan(1000);
      
      limiter.reset();
      
      expect(limiter.shouldBlock()).toBe(false);
      expect(limiter.getCurrentInterval()).toBe(1000);
      expect(limiter.getState().consecutiveFailures).toBe(0);
      expect(limiter.getState().isRateLimited).toBe(false);
    });
  });
});

describe('isRateLimitError', () => {
  it('should return true for error with status 429', () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it('should return true for error with response.status 429', () => {
    expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
  });

  it('should return true for error message containing 429', () => {
    expect(isRateLimitError({ message: 'Error 429: Too Many Requests' })).toBe(true);
  });

  it('should return true for error message containing rate limit', () => {
    expect(isRateLimitError({ message: 'Rate limit exceeded' })).toBe(true);
  });

  it('should return true for error message containing too many requests', () => {
    expect(isRateLimitError({ message: 'too many requests' })).toBe(true);
  });

  it('should return false for other errors', () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
    expect(isRateLimitError({ message: 'Internal server error' })).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });

  it('should return false for non-objects', () => {
    expect(isRateLimitError('error')).toBe(false);
    expect(isRateLimitError(123)).toBe(false);
  });
});

