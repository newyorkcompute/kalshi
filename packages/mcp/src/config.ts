import { Configuration, MarketApi } from "kalshi-typescript";

/**
 * Kalshi API configuration from environment variables
 */
export interface KalshiConfig {
  apiKey: string;
  privateKey: string;
  basePath: string;
}

/**
 * Get Kalshi configuration from environment variables
 */
export function getKalshiConfig(): KalshiConfig {
  const apiKey = process.env.KALSHI_API_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;
  const basePath =
    process.env.KALSHI_BASE_PATH ||
    "https://api.elections.kalshi.com/trade-api/v2";

  if (!apiKey) {
    throw new Error("KALSHI_API_KEY environment variable is required");
  }

  if (!privateKey) {
    throw new Error("KALSHI_PRIVATE_KEY environment variable is required");
  }

  return { apiKey, privateKey, basePath };
}

/**
 * Create a configured Kalshi SDK Configuration instance
 */
export function createSdkConfig(config: KalshiConfig): Configuration {
  return new Configuration({
    apiKey: config.apiKey,
    privateKeyPem: config.privateKey,
    basePath: config.basePath,
  });
}

/**
 * Create a MarketApi instance with the given configuration
 */
export function createMarketApi(config: KalshiConfig): MarketApi {
  const sdkConfig = createSdkConfig(config);
  return new MarketApi(sdkConfig);
}

