/** Per-page timeout for Kalshi market pagination requests (ms). */
export const PAGE_REQUEST_TIMEOUT_MS = 15_000;

/** Max attempts per pagination page (initial try + retries). */
export const PAGE_FETCH_MAX_ATTEMPTS = 3;

/** Base delay for exponential backoff between retries (ms). */
export const PAGE_FETCH_RETRY_BASE_DELAY_MS = 1_000;

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
  "ERR_NETWORK",
]);

export interface FetchWithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasRetryableCode(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return typeof code === "string" && RETRYABLE_ERROR_CODES.has(code);
}

function isAxiosNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const axiosError = error as { isAxiosError?: boolean; response?: unknown };
  return axiosError.isAxiosError === true && axiosError.response === undefined;
}

/** Returns true for transient network/timeout failures worth retrying. */
export function isRetryableNetworkError(error: unknown): boolean {
  if (hasRetryableCode(error)) return true;
  if (isAxiosNetworkError(error)) return true;

  if (error instanceof Error && /timeout/i.test(error.message)) {
    return true;
  }

  return false;
}

/**
 * Run an async operation with exponential backoff retries on network errors.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: FetchWithRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? PAGE_FETCH_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? PAGE_FETCH_RETRY_BASE_DELAY_MS;
  const isRetryable = options.isRetryable ?? isRetryableNetworkError;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const canRetry = attempt < maxAttempts && isRetryable(error);
      if (!canRetry) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError;
}
