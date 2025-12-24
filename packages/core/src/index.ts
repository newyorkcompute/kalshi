/**
 * @newyorkcompute/kalshi-core
 *
 * Shared utilities for Kalshi prediction market tools.
 */

// Configuration
export {
  type KalshiConfig,
  DEFAULT_BASE_PATH,
  DEMO_BASE_PATH,
  getKalshiConfig,
  createSdkConfig,
  createMarketApi,
  createPortfolioApi,
  createOrdersApi,
  createEventsApi,
} from "./config.js";

// Formatting utilities
export {
  formatPrice,
  formatCurrency,
  formatPercent,
  formatPriceChange,
  formatCompactNumber,
  formatRelativeTime,
  truncate,
  padString,
} from "./format.js";

// Types
export * from "./types.js";

// Utilities
export { withTimeout, TimeoutError } from "./with-timeout.js";

