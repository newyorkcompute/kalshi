import { useEffect, useRef, useCallback } from "react";

export interface PollingOptions {
  interval: number; // Base polling interval (ms)
  maxRetryDelay: number; // Max backoff delay (default: 5 min)
  maxConsecutiveErrors: number; // Circuit breaker threshold (default: 5)
  onError?: (error: Error) => void;
}

export interface PollingState {
  retryDelay: number;
  consecutiveErrors: number;
  isCircuitOpen: boolean;
}

/**
 * Generic polling hook with exponential backoff and circuit breaker
 *
 * Features:
 * - Exponential backoff on rate limit errors (429)
 * - Circuit breaker after max consecutive errors
 * - Automatic retry with increasing delays
 * - Reset on successful fetch
 *
 * @param fetchFn - Async function to poll
 * @param options - Polling configuration
 * @returns Current polling state
 */
export function usePolling(
  fetchFn: () => Promise<void>,
  options: PollingOptions
): PollingState {
  const retryDelayRef = useRef(options.interval);
  const consecutiveErrorsRef = useRef(0);
  const isCircuitOpenRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const poll = useCallback(async () => {
    if (isCircuitOpenRef.current) {
      return; // Circuit breaker open
    }

    try {
      await fetchFn();

      // Success: reset backoff
      retryDelayRef.current = options.interval;
      consecutiveErrorsRef.current = 0;
    } catch (error) {
      consecutiveErrorsRef.current++;

      // Check for rate limit (429)
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.toLowerCase().includes("rate limit"));

      if (isRateLimit) {
        // Exponential backoff
        retryDelayRef.current = Math.min(
          retryDelayRef.current * 2,
          options.maxRetryDelay
        );
      }

      // Circuit breaker
      if (consecutiveErrorsRef.current >= options.maxConsecutiveErrors) {
        isCircuitOpenRef.current = true;
        console.error(
          "Circuit breaker opened after",
          options.maxConsecutiveErrors,
          "failures"
        );
      }

      options.onError?.(error as Error);
    }

    // Schedule next poll
    timeoutRef.current = setTimeout(poll, retryDelayRef.current);
  }, [fetchFn, options]);

  useEffect(() => {
    poll(); // Initial fetch
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [poll]);

  return {
    retryDelay: retryDelayRef.current,
    consecutiveErrors: consecutiveErrorsRef.current,
    isCircuitOpen: isCircuitOpenRef.current,
  };
}

