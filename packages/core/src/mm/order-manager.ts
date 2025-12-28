/**
 * Order Manager
 *
 * Manages the lifecycle of orders for market making.
 * Handles placement, cancellation, and tracking of orders.
 */

import type { OrdersApi } from "kalshi-typescript";
import type {
  ManagedOrder,
  Side,
  Action,
  OrderStatus,
  Quote,
} from "./types.js";

/** Input for creating a new order */
export interface CreateOrderInput {
  ticker: string;
  side: Side;
  action: Action;
  price: number;
  count: number;
}

/** Result of order placement */
export interface PlaceOrderResult {
  success: boolean;
  order?: ManagedOrder;
  error?: string;
}

/**
 * Generates a unique client order ID
 */
function generateClientOrderId(): string {
  return `mm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * OrderManager handles order lifecycle for market making
 */
export class OrderManager {
  private orders: Map<string, ManagedOrder> = new Map();
  private ordersApi: OrdersApi;

  constructor(ordersApi: OrdersApi) {
    this.ordersApi = ordersApi;
  }

  /**
   * Place a new order
   */
  async place(input: CreateOrderInput): Promise<PlaceOrderResult> {
    const clientOrderId = generateClientOrderId();

    // Create managed order (pending)
    const managedOrder: ManagedOrder = {
      clientOrderId,
      ticker: input.ticker,
      side: input.side,
      action: input.action,
      price: input.price,
      count: input.count,
      status: "pending",
      createdAt: new Date(),
      filledCount: 0,
    };

    this.orders.set(clientOrderId, managedOrder);

    try {
      // Place via Kalshi API
      const response = await this.ordersApi.createOrder({
        ticker: input.ticker,
        type: "limit",
        side: input.side,
        action: input.action,
        yes_price: input.side === "yes" ? input.price : undefined,
        no_price: input.side === "no" ? input.price : undefined,
        count: input.count,
        client_order_id: clientOrderId,
      });

      // Update with Kalshi order ID
      const kalshiOrder = response.data.order;
      managedOrder.id = kalshiOrder?.order_id;
      managedOrder.status = this.mapKalshiStatus(kalshiOrder?.status);

      return { success: true, order: managedOrder };
    } catch (error) {
      managedOrder.status = "failed";
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, order: managedOrder, error: errorMessage };
    }
  }

  /**
   * Place multiple orders (for two-sided quotes)
   */
  async placeBulk(inputs: CreateOrderInput[]): Promise<PlaceOrderResult[]> {
    // Place in parallel for speed
    return Promise.all(inputs.map((input) => this.place(input)));
  }

  /**
   * Cancel a specific order by client order ID
   */
  async cancel(clientOrderId: string): Promise<boolean> {
    const order = this.orders.get(clientOrderId);
    if (!order || !order.id) {
      return false;
    }

    try {
      await this.ordersApi.cancelOrder(order.id);
      order.status = "cancelled";
      return true;
    } catch {
      // Order may already be filled or cancelled
      return false;
    }
  }

  /**
   * Cancel all orders, optionally filtered by ticker
   */
  async cancelAll(ticker?: string): Promise<number> {
    const ordersToCancel = this.getActive(ticker);
    let cancelledCount = 0;

    // Cancel in parallel
    const results = await Promise.allSettled(
      ordersToCancel.map((order) => this.cancel(order.clientOrderId))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * Get all active (open/partial) orders
   */
  getActive(ticker?: string): ManagedOrder[] {
    const activeStatuses: OrderStatus[] = ["pending", "open", "partial"];
    const result: ManagedOrder[] = [];

    for (const order of this.orders.values()) {
      if (!activeStatuses.includes(order.status)) continue;
      if (ticker && order.ticker !== ticker) continue;
      result.push(order);
    }

    return result;
  }

  /**
   * Get all orders (including filled/cancelled)
   */
  getAll(): ManagedOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get order by client order ID
   */
  get(clientOrderId: string): ManagedOrder | undefined {
    return this.orders.get(clientOrderId);
  }

  /**
   * Update order status (called when we receive fill/cancel events)
   */
  updateStatus(
    clientOrderId: string,
    status: OrderStatus,
    filledCount?: number,
    avgFillPrice?: number
  ): void {
    const order = this.orders.get(clientOrderId);
    if (!order) return;

    order.status = status;
    if (filledCount !== undefined) {
      order.filledCount = filledCount;
    }
    if (avgFillPrice !== undefined) {
      order.avgFillPrice = avgFillPrice;
    }
  }

  /**
   * Update quotes for a market (ATOMIC: place new BEFORE canceling old)
   *
   * This is the main method for market making - it updates quotes with
   * minimal exposure gap:
   * 1. Place new orders first (briefly have double exposure)
   * 2. Cancel old orders only after new ones confirmed
   *
   * This prevents the "naked" period where we have no quotes in market.
   */
  async updateQuote(quote: Quote): Promise<{
    cancelled: number;
    placed: PlaceOrderResult[];
  }> {
    // Get existing orders for this ticker BEFORE placing new ones
    const existingOrders = this.getActive(quote.ticker);

    // Build new orders
    const newOrders: CreateOrderInput[] = [];

    // Bid (buy YES at bid price)
    if (quote.bidSize > 0 && quote.bidPrice >= 1 && quote.bidPrice <= 99) {
      newOrders.push({
        ticker: quote.ticker,
        side: quote.side,
        action: "buy",
        price: quote.bidPrice,
        count: quote.bidSize,
      });
    }

    // Ask (sell YES at ask price, or buy NO)
    if (quote.askSize > 0 && quote.askPrice >= 1 && quote.askPrice <= 99) {
      newOrders.push({
        ticker: quote.ticker,
        side: quote.side,
        action: "sell",
        price: quote.askPrice,
        count: quote.askSize,
      });
    }

    // 1. Place new orders FIRST (we briefly have double exposure)
    const placed = await this.placeBulk(newOrders);

    // 2. Cancel old orders AFTER new ones are placed
    // Even if new orders fail, we still cancel old stale quotes
    let cancelled = 0;
    if (existingOrders.length > 0) {
      const cancelResults = await Promise.allSettled(
        existingOrders.map((order) => this.cancel(order.clientOrderId))
      );
      for (const result of cancelResults) {
        if (result.status === "fulfilled" && result.value) {
          cancelled++;
        }
      }
    }

    return { cancelled, placed };
  }

  /**
   * Update quotes (legacy mode: cancel first, then place)
   * Use this if you're hitting rate limits from double orders
   */
  async updateQuoteLegacy(quote: Quote): Promise<{
    cancelled: number;
    placed: PlaceOrderResult[];
  }> {
    // 1. Cancel existing orders for this ticker
    const cancelled = await this.cancelAll(quote.ticker);

    // 2. Place new bid and ask orders
    const orders: CreateOrderInput[] = [];

    if (quote.bidSize > 0 && quote.bidPrice >= 1 && quote.bidPrice <= 99) {
      orders.push({
        ticker: quote.ticker,
        side: quote.side,
        action: "buy",
        price: quote.bidPrice,
        count: quote.bidSize,
      });
    }

    if (quote.askSize > 0 && quote.askPrice >= 1 && quote.askPrice <= 99) {
      orders.push({
        ticker: quote.ticker,
        side: quote.side,
        action: "sell",
        price: quote.askPrice,
        count: quote.askSize,
      });
    }

    const placed = await this.placeBulk(orders);

    return { cancelled, placed };
  }

  /**
   * Clean up old completed orders (keep memory bounded)
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const completedStatuses: OrderStatus[] = ["filled", "cancelled", "failed"];
    let removed = 0;

    for (const [id, order] of this.orders) {
      if (!completedStatuses.includes(order.status)) continue;
      if (now - order.createdAt.getTime() > maxAge) {
        this.orders.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Map Kalshi order status to our internal status
   */
  private mapKalshiStatus(status?: string): OrderStatus {
    switch (status?.toLowerCase()) {
      case "resting":
        return "open";
      case "pending":
        return "pending";
      case "executed":
        return "filled";
      case "canceled":
      case "cancelled":
        return "cancelled";
      default:
        return "pending";
    }
  }
}

