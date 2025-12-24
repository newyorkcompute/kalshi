import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout, TimeoutError } from "./with-timeout.js";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve if promise completes before timeout", async () => {
    const promise = Promise.resolve("success");
    const resultPromise = withTimeout(promise, 1000);

    const result = await resultPromise;
    expect(result).toBe("success");
  });

  it("should reject with TimeoutError if promise takes too long", async () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve("too late"), 2000);
    });

    const resultPromise = withTimeout(promise, 100, "Custom timeout message");

    vi.advanceTimersByTime(100);

    await expect(resultPromise).rejects.toThrow(TimeoutError);
    await expect(resultPromise).rejects.toThrow("Custom timeout message");
  });

  it("should reject with original error if promise rejects", async () => {
    const promise = Promise.reject(new Error("Network error"));

    await expect(withTimeout(promise, 1000)).rejects.toThrow("Network error");
  });

  it("should use default error message if not provided", async () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve("too late"), 2000);
    });

    const resultPromise = withTimeout(promise, 100);

    vi.advanceTimersByTime(100);

    await expect(resultPromise).rejects.toThrow("Request timeout");
  });

  it("should handle promise that resolves exactly at timeout", async () => {
    let resolvePromise: (value: string) => void;
    const promise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const resultPromise = withTimeout(promise, 1000);

    // Resolve just before timeout
    vi.advanceTimersByTime(999);
    resolvePromise!("just in time");

    const result = await resultPromise;
    expect(result).toBe("just in time");
  });

  it("should handle different data types", async () => {
    const numberPromise = Promise.resolve(42);
    expect(await withTimeout(numberPromise, 1000)).toBe(42);

    const objectPromise = Promise.resolve({ foo: "bar" });
    expect(await withTimeout(objectPromise, 1000)).toEqual({ foo: "bar" });

    const arrayPromise = Promise.resolve([1, 2, 3]);
    expect(await withTimeout(arrayPromise, 1000)).toEqual([1, 2, 3]);
  });

  it("should have correct error name", async () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => resolve("too late"), 2000);
    });

    const resultPromise = withTimeout(promise, 100);
    vi.advanceTimersByTime(100);

    try {
      await resultPromise;
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
      expect((error as TimeoutError).name).toBe("TimeoutError");
    }
  });
});

