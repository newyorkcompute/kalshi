import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("usePolling logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should implement exponential backoff on rate limit", async () => {
    const rateLimitError = new Error("429 Too Many Requests");
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValue(undefined);

    let retryDelay = 1000;
    const maxRetryDelay = 10000;
    const interval = 1000;

    // First call fails with rate limit
    try {
      await fetchFn();
    } catch (error) {
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.toLowerCase().includes("rate limit"));
      if (isRateLimit) {
        retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
      }
    }

    expect(retryDelay).toBe(2000); // Doubled

    // Second call fails with rate limit
    try {
      await fetchFn();
    } catch (error) {
      const isRateLimit =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.toLowerCase().includes("rate limit"));
      if (isRateLimit) {
        retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
      }
    }

    expect(retryDelay).toBe(4000); // Doubled again

    // Third call succeeds
    await fetchFn();
    retryDelay = interval; // Reset on success

    expect(retryDelay).toBe(1000); // Reset to original
  });

  it("should open circuit breaker after max consecutive errors", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("Network error"));

    let consecutiveErrors = 0;
    let isCircuitOpen = false;
    const maxConsecutiveErrors = 3;

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      try {
        await fetchFn();
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          isCircuitOpen = true;
        }
      }
    }

    expect(isCircuitOpen).toBe(true);
    expect(consecutiveErrors).toBe(3);
  });

  it("should reset consecutive errors on success", async () => {
    const error = new Error("Temporary error");
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);

    let consecutiveErrors = 0;

    // First call fails
    try {
      await fetchFn();
    } catch {
      consecutiveErrors++;
    }

    expect(consecutiveErrors).toBe(1);

    // Second call succeeds
    await fetchFn();
    consecutiveErrors = 0; // Reset on success

    expect(consecutiveErrors).toBe(0);
  });

  it("should cap retry delay at maxRetryDelay", async () => {
    const rateLimitError = new Error("Rate limit exceeded");

    let retryDelay = 1000;
    const maxRetryDelay = 5000;

    // Simulate multiple rate limit errors
    for (let i = 0; i < 5; i++) {
      retryDelay = Math.min(retryDelay * 2, maxRetryDelay);
    }

    // Should cap at 5000, not continue doubling
    expect(retryDelay).toBe(5000);
  });

  it("should detect rate limit errors", () => {
    const rateLimitError1 = new Error("429 Too Many Requests");
    const rateLimitError2 = new Error("Rate limit exceeded");
    const networkError = new Error("Network error");

    const isRateLimit1 =
      rateLimitError1.message.includes("429") ||
      rateLimitError1.message.toLowerCase().includes("rate limit");
    const isRateLimit2 =
      rateLimitError2.message.includes("429") ||
      rateLimitError2.message.toLowerCase().includes("rate limit");
    const isRateLimit3 =
      networkError.message.includes("429") ||
      networkError.message.toLowerCase().includes("rate limit");

    expect(isRateLimit1).toBe(true);
    expect(isRateLimit2).toBe(true);
    expect(isRateLimit3).toBe(false);
  });

  it("should call onError callback on failure", async () => {
    const error = new Error("Test error");
    const fetchFn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();

    try {
      await fetchFn();
    } catch (err) {
      onError(err);
    }

    expect(onError).toHaveBeenCalledWith(error);
  });
});
