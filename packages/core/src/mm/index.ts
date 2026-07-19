/**
 * Market Maker Module
 *
 * Core primitives for building market making systems.
 */

// Types
export type {
  Side,
  Action,
  OrderStatus,
  ManagedOrder,
  Quote,
  Position,
  RiskLimits,
  RiskCheckResult,
  Fill,
  PnLSummary,
  ComplianceConfig,
  LiquidityCondition,
  AvailabilityMetrics,
  AuditRecord,
} from "./types.js";

// Order Manager
export {
  OrderManager,
  type CreateOrderInput,
  type PlaceOrderResult,
} from "./order-manager.js";

export {
  createOrdersV2Client,
  KalshiOrdersV2Client,
  mapToYesBookOrder,
  toCreateOrderV2Request,
  statusFromV2Counts,
  type OrdersV2Client,
  type CreateOrderV2Request,
  type CreateOrderV2Response,
  type BookSide,
} from "./orders-v2.js";

// Inventory Tracker
export { InventoryTracker } from "./inventory.js";

// Risk Manager
export { RiskManager, DEFAULT_RISK_LIMITS } from "./risk.js";

// Local Orderbook
export {
  LocalOrderbook,
  OrderbookManager,
  type PriceLevel,
  type OrderbookSnapshot,
  type OrderbookDelta,
  type BBO,
} from "./orderbook.js";

