import { describe, it, expect, vi } from "vitest";
import {
  fetchWithRetry,
  isRetryableNetworkError,
  PAGE_FETCH_MAX_ATTEMPTS,
  PAGE_FETCH_RETRY_BASE_DELAY_MS,
} from "./fetch-with-retry.js";

describe("isRetryableNetworkError", () => {
  it("treats common network error codes as retryable", () => {
    expect(isRetryableNetworkError({ code: "ECONNRESET" })).toBe(true);
    expect(isRetryableNetworkError({ code: "ECONNABORTED" })).toBe(true);
    expect(isRetryableNetworkError({ code: "ETIMEDOUT" })).toBe(true);
  });

  it("treats axios network errors without a response as retryable", () => {
    expect(isRetryableNetworkError({ isAxiosError: true, response: undefined })).toBe(true);
  });

  it("does not retry HTTP 4xx/5xx responses", () => {
    expect(
      isRetryableNetworkError({
        isAxiosError: true,
        response: { status: 500 },
      }),
    ).toBe(false);
  });

  it("does not retry generic application errors", () => {
    expect(isRetryableNetworkError(new Error("invalid ticker"))).toBe(false);
  });
});

describe("fetchWithRetry", () => {
  it("returns the result on the first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(fetchWithRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors with exponential backoff", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: "ECONNRESET" })
      .mockRejectedValueOnce({ code: "ETIMEDOUT" })
      .mockResolvedValue("page");

    await expect(
      fetchWithRetry(fn, {
        sleep,
        baseDelayMs: PAGE_FETCH_RETRY_BASE_DELAY_MS,
      }),
    ).resolves.toBe("page");

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, PAGE_FETCH_RETRY_BASE_DELAY_MS);
    expect(sleep).toHaveBeenNthCalledWith(2, PAGE_FETCH_RETRY_BASE_DELAY_MS * 2);
  });

  it("throws after exhausting retryable attempts", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const error = { code: "ECONNRESET" };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      fetchWithRetry(fn, {
        sleep,
        maxAttempts: PAGE_FETCH_MAX_ATTEMPTS,
      }),
    ).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(PAGE_FETCH_MAX_ATTEMPTS);
    expect(sleep).toHaveBeenCalledTimes(PAGE_FETCH_MAX_ATTEMPTS - 1);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const error = new Error("bad request");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(fetchWithRetry(fn, { sleep })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
