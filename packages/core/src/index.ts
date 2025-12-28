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
  formatExpiry,
  calculateSpread,
  truncate,
  padString,
} from "./format.js";

// Cache utilities
export {
  getCached,
  setCache,
  clearCache,
  clearAllCache,
  getCacheStats,
  CACHE_TTL,
} from "./cache.js";

// Rate limiting
export {
  createRateLimiter,
  isRateLimitError,
  type RateLimiter,
  type RateLimiterConfig,
  type RateLimiterState,
} from "./rate-limiter.js";

// Types
export * from "./types.js";

// Utilities
export { withTimeout, TimeoutError } from "./with-timeout.js";

// Validation
export {
  validateOrder,
  type OrderValidationInput,
  type OrderValidationResult,
} from "./validate-order.js";

// WebSocket (real-time data)
export {
  KalshiWsClient,
  generateWsAuthHeaders,
  generateSignedWsUrl,
  type KalshiWsConfig,
  type KalshiWsEventHandlers,
  type SubscriptionChannel,
  type ConnectionState,
  type ActiveSubscriptions,
  type OrderbookDeltaMessage,
  type TickerMessage,
  type TradeMessage,
  type FillMessage,
  type WsMessage,
  WS_ENDPOINTS,
} from "./websocket/index.js";

// Market Making primitives
export {
  OrderManager,
  InventoryTracker,
  RiskManager,
  LocalOrderbook,
  OrderbookManager,
  DEFAULT_RISK_LIMITS,
  type Side,
  type Action,
  type OrderStatus,
  type ManagedOrder,
  type Quote,
  type Position,
  type RiskLimits,
  type RiskCheckResult,
  type Fill,
  type PnLSummary,
  type CreateOrderInput,
  type PlaceOrderResult,
  type PriceLevel,
  type OrderbookSnapshot,
  type OrderbookDelta,
  type BBO,
} from "./mm/index.js";
