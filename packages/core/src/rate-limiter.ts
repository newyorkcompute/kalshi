/**
 * Rate Limiter
 * 
 * Implements exponential backoff and circuit breaker patterns
 * for handling API rate limits gracefully.
 */

export interface RateLimiterConfig {
  /** Minimum interval between requests in ms (default: 1000) */
  minInterval: number;
  /** Maximum interval between requests in ms (default: 60000) */
  maxInterval: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
  /** Number of consecutive failures before circuit opens (default: 5) */
  circuitBreakerThreshold: number;
  /** Time to wait before attempting to close circuit in ms (default: 30000) */
  circuitResetTimeout: number;
}

export interface RateLimiterState {
  /** Current interval between requests */
  currentInterval: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Whether the circuit breaker is open (blocking requests) */
  isCircuitOpen: boolean;
  /** Whether rate limiting is active */
  isRateLimited: boolean;
  /** Timestamp of last successful request */
  lastSuccessTime: number;
  /** Timestamp of last failure */
  lastFailureTime: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  minInterval: 1000,
  maxInterval: 60000,
  backoffMultiplier: 2,
  circuitBreakerThreshold: 5,
  circuitResetTimeout: 30000,
};

/**
 * Create a rate limiter instance
 * 
 * @example
 * ```ts
 * const limiter = createRateLimiter();
 * 
 * async function fetchData() {
 *   if (limiter.shouldBlock()) {
 *     return; // Skip request
 *   }
 *   
 *   try {
 *     const data = await api.getData();
 *     limiter.recordSuccess();
 *     return data;
 *   } catch (err) {
 *     if (isRateLimitError(err)) {
 *       limiter.recordRateLimitError();
 *     } else {
 *       limiter.recordFailure();
 *     }
 *     throw err;
 *   }
 * }
 * ```
 */
export function createRateLimiter(config: Partial<RateLimiterConfig> = {}) {
  const cfg: RateLimiterConfig = { ...DEFAULT_CONFIG, ...config };
  
  let state: RateLimiterState = {
    currentInterval: cfg.minInterval,
    consecutiveFailures: 0,
    isCircuitOpen: false,
    isRateLimited: false,
    lastSuccessTime: 0,
    lastFailureTime: 0,
  };

  let circuitResetTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Check if requests should be blocked
   */
  function shouldBlock(): boolean {
    return state.isCircuitOpen;
  }

  /**
   * Get the current recommended interval between requests
   */
  function getCurrentInterval(): number {
    return state.currentInterval;
  }

  /**
   * Get the current state (for debugging/display)
   */
  function getState(): Readonly<RateLimiterState> {
    return { ...state };
  }

  /**
   * Record a successful request - resets backoff
   */
  function recordSuccess(): void {
    state.consecutiveFailures = 0;
    state.currentInterval = cfg.minInterval;
    state.isRateLimited = false;
    state.lastSuccessTime = Date.now();
    
    // Close circuit if it was open
    if (state.isCircuitOpen) {
      state.isCircuitOpen = false;
      if (circuitResetTimer) {
        clearTimeout(circuitResetTimer);
        circuitResetTimer = null;
      }
    }
  }

  /**
   * Record a rate limit error (429) - applies exponential backoff
   */
  function recordRateLimitError(): void {
    state.consecutiveFailures++;
    state.isRateLimited = true;
    state.lastFailureTime = Date.now();
    
    // Apply exponential backoff
    state.currentInterval = Math.min(
      state.currentInterval * cfg.backoffMultiplier,
      cfg.maxInterval
    );
    
    // Open circuit if threshold reached
    if (state.consecutiveFailures >= cfg.circuitBreakerThreshold) {
      openCircuit();
    }
  }

  /**
   * Record a general failure (not rate limit)
   */
  function recordFailure(): void {
    state.consecutiveFailures++;
    state.lastFailureTime = Date.now();
    
    // Open circuit if threshold reached
    if (state.consecutiveFailures >= cfg.circuitBreakerThreshold) {
      openCircuit();
    }
  }

  /**
   * Open the circuit breaker (block all requests temporarily)
   */
  function openCircuit(): void {
    if (state.isCircuitOpen) return;
    
    state.isCircuitOpen = true;
    
    // Schedule circuit reset
    circuitResetTimer = setTimeout(() => {
      state.isCircuitOpen = false;
      state.consecutiveFailures = 0;
      state.currentInterval = cfg.minInterval;
      circuitResetTimer = null;
    }, cfg.circuitResetTimeout);
  }

  /**
   * Reset the rate limiter to initial state
   */
  function reset(): void {
    if (circuitResetTimer) {
      clearTimeout(circuitResetTimer);
      circuitResetTimer = null;
    }
    
    state = {
      currentInterval: cfg.minInterval,
      consecutiveFailures: 0,
      isCircuitOpen: false,
      isRateLimited: false,
      lastSuccessTime: 0,
      lastFailureTime: 0,
    };
  }

  return {
    shouldBlock,
    getCurrentInterval,
    getState,
    recordSuccess,
    recordRateLimitError,
    recordFailure,
    reset,
  };
}

/**
 * Type for the rate limiter instance
 */
export type RateLimiter = ReturnType<typeof createRateLimiter>;

/**
 * Check if an error is a rate limit error (HTTP 429)
 * 
 * @param error - Error to check
 * @returns true if the error is a rate limit error
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  // Check for status code 429
  if ('status' in error && error.status === 429) return true;
  if ('response' in error) {
    const response = error.response as { status?: number } | undefined;
    if (response?.status === 429) return true;
  }
  
  // Check error message
  if ('message' in error && typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return true;
    }
  }
  
  return false;
}

