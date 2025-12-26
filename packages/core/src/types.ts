/**
 * Re-exported Types from kalshi-typescript
 *
 * Only exports types that are verified to exist in the SDK.
 * For response types, use the API methods directly.
 */

// Re-export API classes for convenience
export type {
  MarketApi,
  PortfolioApi,
  OrdersApi,
  EventsApi,
  Configuration,
} from "kalshi-typescript";

// Re-export enums
export {
  GetMarketsStatusEnum,
  GetEventsStatusEnum,
  CreateOrderRequestSideEnum,
  CreateOrderRequestActionEnum,
  CreateOrderRequestTypeEnum,
} from "kalshi-typescript";

/**
 * Side of an order or position
 */
export type Side = "yes" | "no";

/**
 * Action for an order
 */
export type Action = "buy" | "sell";

/**
 * Order type
 */
export type OrderType = "limit" | "market";

/**
 * Market status
 */
export type MarketStatus = "open" | "closed" | "settled";

/**
 * Order status
 */
export type OrderStatus = "resting" | "canceled" | "executed" | "pending";

/**
 * Simplified Market interface for display
 */
export interface MarketDisplay {
  ticker: string;
  title: string;
  status: MarketStatus;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  close_time?: string;
}

/**
 * Simplified Position interface for display
 */
export interface PositionDisplay {
  ticker: string;
  position: number;
  market_exposure: number;
  realized_pnl?: number;
  total_traded?: number;
}

/**
 * Simplified Order interface for display
 */
export interface OrderDisplay {
  order_id: string;
  ticker: string;
  side: Side;
  action: Action;
  type: OrderType;
  count: number;
  remaining_count: number;
  yes_price?: number;
  no_price?: number;
  status: string;
  created_time?: string;
}

/**
 * Orderbook level [price, quantity]
 */
export type OrderbookLevel = [number, number];

/**
 * Simplified Orderbook interface for display
 */
export interface OrderbookDisplay {
  yes: OrderbookLevel[];
  no: OrderbookLevel[];
}
