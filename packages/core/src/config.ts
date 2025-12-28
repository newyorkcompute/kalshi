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
 * Kalshi API configuration credentials
 *
 * @property apiKey - Kalshi API key ID
 * @property privateKey - RSA private key in PEM format
 * @property basePath - API base URL (production or demo)
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
 * Reads from:
 * - `KALSHI_API_KEY` - Required API key ID
 * - `KALSHI_PRIVATE_KEY` - Required RSA private key (PEM format)
 * - `KALSHI_BASE_PATH` - Optional base URL (defaults to production)
 *
 * @returns Kalshi configuration object
 * @throws Error if KALSHI_API_KEY or KALSHI_PRIVATE_KEY is missing
 *
 * @example
 * ```ts
 * const config = getKalshiConfig();
 * const marketApi = createMarketApi(config);
 * ```
 */
export function getKalshiConfig(): KalshiConfig {
  const apiKey = process.env.KALSHI_API_KEY;
  let privateKey = process.env.KALSHI_PRIVATE_KEY;
  const basePath = process.env.KALSHI_BASE_PATH || DEFAULT_BASE_PATH;

  if (!apiKey) {
    throw new Error("KALSHI_API_KEY environment variable is required");
  }

  if (!privateKey) {
    throw new Error("KALSHI_PRIVATE_KEY environment variable is required");
  }

  // Handle escaped newlines from .env files
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  return { apiKey, privateKey, basePath };
}

/**
 * Create a configured Kalshi SDK Configuration instance
 *
 * @param config - Kalshi API credentials
 * @returns SDK Configuration instance for API clients
 */
export function createSdkConfig(config: KalshiConfig): Configuration {
  return new Configuration({
    apiKey: config.apiKey,
    privateKeyPem: config.privateKey,
    basePath: config.basePath,
  });
}

/**
 * Create a MarketApi instance for market data operations
 *
 * @param config - Kalshi API credentials
 * @returns Configured MarketApi client
 *
 * @example
 * ```ts
 * const api = createMarketApi(config);
 * const markets = await api.getMarkets();
 * ```
 */
export function createMarketApi(config: KalshiConfig): MarketApi {
  const sdkConfig = createSdkConfig(config);
  return new MarketApi(sdkConfig);
}

/**
 * Create a PortfolioApi instance for portfolio operations
 *
 * @param config - Kalshi API credentials
 * @returns Configured PortfolioApi client
 *
 * @example
 * ```ts
 * const api = createPortfolioApi(config);
 * const balance = await api.getBalance();
 * ```
 */
export function createPortfolioApi(config: KalshiConfig): PortfolioApi {
  const sdkConfig = createSdkConfig(config);
  return new PortfolioApi(sdkConfig);
}

/**
 * Create an OrdersApi instance for order management
 *
 * @param config - Kalshi API credentials
 * @returns Configured OrdersApi client
 *
 * @example
 * ```ts
 * const api = createOrdersApi(config);
 * const orders = await api.getOrders();
 * ```
 */
export function createOrdersApi(config: KalshiConfig): OrdersApi {
  const sdkConfig = createSdkConfig(config);
  return new OrdersApi(sdkConfig);
}

/**
 * Create an EventsApi instance for event data operations
 *
 * @param config - Kalshi API credentials
 * @returns Configured EventsApi client
 *
 * @example
 * ```ts
 * const api = createEventsApi(config);
 * const events = await api.getEvents();
 * ```
 */
export function createEventsApi(config: KalshiConfig): EventsApi {
  const sdkConfig = createSdkConfig(config);
  return new EventsApi(sdkConfig);
}

