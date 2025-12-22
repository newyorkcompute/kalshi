/**
 * Kalshi SDK Configuration
 *
 * Provides configuration and factory functions for Kalshi API clients.
 */

import {
  Configuration,
  MarketApi,
  PortfolioApi,
  OrdersApi,
  EventsApi,
} from "kalshi-typescript";

/**
 * Kalshi API configuration
 */
export interface KalshiConfig {
  apiKey: string;
  privateKey: string;
  basePath: string;
}

/**
 * Default Kalshi API base path (production)
 */
export const DEFAULT_BASE_PATH = "https://api.elections.kalshi.com/trade-api/v2";

/**
 * Demo/sandbox API base path
 */
export const DEMO_BASE_PATH = "https://demo-api.kalshi.co/trade-api/v2";

/**
 * Get Kalshi configuration from environment variables
 *
 * @throws Error if required environment variables are missing
 */
export function getKalshiConfig(): KalshiConfig {
  const apiKey = process.env.KALSHI_API_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;
  const basePath = process.env.KALSHI_BASE_PATH || DEFAULT_BASE_PATH;

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

/**
 * Create a PortfolioApi instance with the given configuration
 */
export function createPortfolioApi(config: KalshiConfig): PortfolioApi {
  const sdkConfig = createSdkConfig(config);
  return new PortfolioApi(sdkConfig);
}

/**
 * Create an OrdersApi instance with the given configuration
 */
export function createOrdersApi(config: KalshiConfig): OrdersApi {
  const sdkConfig = createSdkConfig(config);
  return new OrdersApi(sdkConfig);
}

/**
 * Create an EventsApi instance with the given configuration
 */
export function createEventsApi(config: KalshiConfig): EventsApi {
  const sdkConfig = createSdkConfig(config);
  return new EventsApi(sdkConfig);
}

