import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getKalshiConfig,
  createSdkConfig,
  createMarketApi,
  createPortfolioApi,
  createOrdersApi,
  createEventsApi,
  DEFAULT_BASE_PATH,
  DEMO_BASE_PATH,
} from "./config.js";

// Mock kalshi-typescript
vi.mock("kalshi-typescript", () => ({
  Configuration: vi.fn().mockImplementation((config) => ({
    apiKey: config.apiKey,
    privateKeyPem: config.privateKeyPem,
    basePath: config.basePath,
  })),
  MarketApi: vi.fn().mockImplementation(() => ({ name: "MarketApi" })),
  PortfolioApi: vi.fn().mockImplementation(() => ({ name: "PortfolioApi" })),
  OrdersApi: vi.fn().mockImplementation(() => ({ name: "OrdersApi" })),
  EventsApi: vi.fn().mockImplementation(() => ({ name: "EventsApi" })),
}));

describe("constants", () => {
  it("exports DEFAULT_BASE_PATH", () => {
    expect(DEFAULT_BASE_PATH).toBe("https://api.elections.kalshi.com/trade-api/v2");
  });

  it("exports DEMO_BASE_PATH", () => {
    expect(DEMO_BASE_PATH).toBe("https://demo-api.kalshi.co/trade-api/v2");
  });
});

describe("getKalshiConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config from environment variables", () => {
    process.env.KALSHI_API_KEY = "test-api-key";
    process.env.KALSHI_PRIVATE_KEY = "test-private-key";

    const config = getKalshiConfig();

    expect(config.apiKey).toBe("test-api-key");
    expect(config.privateKey).toBe("test-private-key");
    expect(config.basePath).toBe(DEFAULT_BASE_PATH);
  });

  it("uses custom base path from environment", () => {
    process.env.KALSHI_API_KEY = "test-api-key";
    process.env.KALSHI_PRIVATE_KEY = "test-private-key";
    process.env.KALSHI_BASE_PATH = DEMO_BASE_PATH;

    const config = getKalshiConfig();

    expect(config.basePath).toBe(DEMO_BASE_PATH);
  });

  it("throws error if KALSHI_API_KEY is missing", () => {
    delete process.env.KALSHI_API_KEY;
    process.env.KALSHI_PRIVATE_KEY = "test-private-key";

    expect(() => getKalshiConfig()).toThrow(
      "KALSHI_API_KEY environment variable is required"
    );
  });

  it("throws error if KALSHI_PRIVATE_KEY is missing", () => {
    process.env.KALSHI_API_KEY = "test-api-key";
    delete process.env.KALSHI_PRIVATE_KEY;

    expect(() => getKalshiConfig()).toThrow(
      "KALSHI_PRIVATE_KEY environment variable is required"
    );
  });
});

describe("createSdkConfig", () => {
  it("creates Configuration with correct parameters", () => {
    const config = {
      apiKey: "test-api-key",
      privateKey: "test-private-key",
      basePath: DEFAULT_BASE_PATH,
    };

    const sdkConfig = createSdkConfig(config);

    expect(sdkConfig.apiKey).toBe("test-api-key");
    expect(sdkConfig.privateKeyPem).toBe("test-private-key");
    expect(sdkConfig.basePath).toBe(DEFAULT_BASE_PATH);
  });
});

describe("API factory functions", () => {
  const testConfig = {
    apiKey: "test-api-key",
    privateKey: "test-private-key",
    basePath: DEFAULT_BASE_PATH,
  };

  it("createMarketApi returns MarketApi instance", () => {
    const api = createMarketApi(testConfig);
    expect(api).toEqual({ name: "MarketApi" });
  });

  it("createPortfolioApi returns PortfolioApi instance", () => {
    const api = createPortfolioApi(testConfig);
    expect(api).toEqual({ name: "PortfolioApi" });
  });

  it("createOrdersApi returns OrdersApi instance", () => {
    const api = createOrdersApi(testConfig);
    expect(api).toEqual({ name: "OrdersApi" });
  });

  it("createEventsApi returns EventsApi instance", () => {
    const api = createEventsApi(testConfig);
    expect(api).toEqual({ name: "EventsApi" });
  });
});

