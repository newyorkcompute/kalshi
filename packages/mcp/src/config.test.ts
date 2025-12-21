import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getKalshiConfig } from "./config.js";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getKalshiConfig", () => {
    it("should return config when all env vars are set", () => {
      process.env.KALSHI_API_KEY = "test-api-key";
      process.env.KALSHI_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

      const config = getKalshiConfig();

      expect(config.apiKey).toBe("test-api-key");
      expect(config.privateKey).toContain("BEGIN RSA PRIVATE KEY");
      expect(config.basePath).toBe(
        "https://api.elections.kalshi.com/trade-api/v2"
      );
    });

    it("should use custom base path when provided", () => {
      process.env.KALSHI_API_KEY = "test-api-key";
      process.env.KALSHI_PRIVATE_KEY = "test-key";
      process.env.KALSHI_BASE_PATH = "https://demo-api.kalshi.com/trade-api/v2";

      const config = getKalshiConfig();

      expect(config.basePath).toBe("https://demo-api.kalshi.com/trade-api/v2");
    });

    it("should throw when KALSHI_API_KEY is missing", () => {
      process.env.KALSHI_PRIVATE_KEY = "test-key";
      delete process.env.KALSHI_API_KEY;

      expect(() => getKalshiConfig()).toThrow(
        "KALSHI_API_KEY environment variable is required"
      );
    });

    it("should throw when KALSHI_PRIVATE_KEY is missing", () => {
      process.env.KALSHI_API_KEY = "test-api-key";
      delete process.env.KALSHI_PRIVATE_KEY;

      expect(() => getKalshiConfig()).toThrow(
        "KALSHI_PRIVATE_KEY environment variable is required"
      );
    });
  });
});

