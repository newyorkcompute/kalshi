import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, getKalshiCredentials, getBasePath, getConfigTemplate } from "./config.js";
import { writeFileSync, unlinkSync } from "fs";
import { DEFAULT_BASE_PATH, DEMO_BASE_PATH } from "@newyorkcompute/kalshi-core";

describe("Config", () => {
  const testConfigPath = "/tmp/test-mm-config.yaml";

  beforeEach(() => {
    // Reset env vars
    delete process.env.KALSHI_API_KEY;
    delete process.env.KALSHI_PRIVATE_KEY;
    delete process.env.MM_CONFIG;
  });

  afterEach(() => {
    // Clean up test file
    try {
      unlinkSync(testConfigPath);
    } catch {
      // File may not exist
    }
  });

  describe("loadConfig", () => {
    it("should load valid config", () => {
      const yaml = `
markets:
  - TEST-MARKET
      `;
      writeFileSync(testConfigPath, yaml);

      const config = loadConfig(testConfigPath);

      expect(config.markets).toEqual(["TEST-MARKET"]);
      expect(config.api.enabled).toBe(true);
      expect(config.api.port).toBe(3001);
      expect(config.kalshi.demo).toBe(true);
      expect(config.strategy.name).toBe("symmetric");
    });

    it("should apply defaults", () => {
      const yaml = `
markets:
  - TEST-MARKET
      `;
      writeFileSync(testConfigPath, yaml);

      const config = loadConfig(testConfigPath);

      expect(config.risk.maxPositionPerMarket).toBe(100);
      expect(config.risk.maxDailyLoss).toBe(5000);
      expect(config.daemon.staleOrderMs).toBe(30000);
    });

    it("should override defaults with custom values", () => {
      const yaml = `
markets:
  - TEST-MARKET
risk:
  maxPositionPerMarket: 200
  maxDailyLoss: 10000
      `;
      writeFileSync(testConfigPath, yaml);

      const config = loadConfig(testConfigPath);

      expect(config.risk.maxPositionPerMarket).toBe(200);
      expect(config.risk.maxDailyLoss).toBe(10000);
    });

    it("should throw on missing file", () => {
      expect(() => loadConfig("/nonexistent/path.yaml")).toThrow(
        "Config file not found"
      );
    });

    it("should default to empty markets when not provided", () => {
      const yaml = `
api:
  port: 3001
      `;
      writeFileSync(testConfigPath, yaml);

      const config = loadConfig(testConfigPath);
      expect(config.markets).toEqual([]);
    });

    it("should throw on invalid port", () => {
      const yaml = `
markets:
  - TEST-MARKET
api:
  port: 99999
      `;
      writeFileSync(testConfigPath, yaml);

      expect(() => loadConfig(testConfigPath)).toThrow("Invalid configuration");
    });

    it("should parse strategy config", () => {
      const yaml = `
markets:
  - TEST-MARKET
strategy:
  name: symmetric
  symmetric:
    spreadCents: 6
    sizePerSide: 20
      `;
      writeFileSync(testConfigPath, yaml);

      const config = loadConfig(testConfigPath);

      expect(config.strategy.name).toBe("symmetric");
      expect(config.strategy.symmetric.spreadCents).toBe(6);
      expect(config.strategy.symmetric.sizePerSide).toBe(20);
    });
  });

  describe("getKalshiCredentials", () => {
    it("should return credentials from env", () => {
      process.env.KALSHI_API_KEY = "test-key";
      process.env.KALSHI_PRIVATE_KEY = "test-private";

      const creds = getKalshiCredentials();

      expect(creds.apiKey).toBe("test-key");
      expect(creds.privateKey).toBe("test-private");
    });

    it("should throw if API key missing", () => {
      process.env.KALSHI_PRIVATE_KEY = "test-private";

      expect(() => getKalshiCredentials()).toThrow("KALSHI_API_KEY");
    });

    it("should throw if private key missing", () => {
      process.env.KALSHI_API_KEY = "test-key";

      expect(() => getKalshiCredentials()).toThrow("KALSHI_PRIVATE_KEY");
    });
  });

  describe("getBasePath", () => {
    it("should return demo path when demo=true", () => {
      expect(getBasePath(true)).toBe(DEMO_BASE_PATH);
    });

    it("should return production path when demo=false", () => {
      expect(getBasePath(false)).toBe(DEFAULT_BASE_PATH);
    });
  });

  describe("getConfigTemplate", () => {
    it("should return valid YAML template", () => {
      const template = getConfigTemplate();

      expect(template).toContain("markets:");
      expect(template).toContain("api:");
      expect(template).toContain("kalshi:");
      expect(template).toContain("strategy:");
      expect(template).toContain("risk:");
      expect(template).toContain("daemon:");
    });
  });
});

