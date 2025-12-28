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
} from "./types.js";

// Order Manager
export {
  OrderManager,
  type CreateOrderInput,
  type PlaceOrderResult,
} from "./order-manager.js";

// Inventory Tracker
export { InventoryTracker } from "./inventory.js";

// Risk Manager
export { RiskManager, DEFAULT_RISK_LIMITS } from "./risk.js";

