/**
 * Order Manager
 *
 * Manages the lifecycle of orders for market making.
 * Handles placement, cancellation, and tracking of orders.
 */

import type { OrdersApi, Order } from "kalshi-typescript";
import type {
  ManagedOrder,
  Side,
  Action,
  OrderStatus,
  Quote,
} from "./types.js";
import { isRateLimitError } from "../rate-limiter.js";

/** Kalshi order status values */
type KalshiOrderStatus = "resting" | "canceled" | "executed" | "pending";

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff on rate limit errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000 } = options;
  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }

      console.log(`[OrderManager] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }

  throw lastError;
}

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
   * @deprecated Use batchCreate() for better performance
   */
  async placeBulk(inputs: CreateOrderInput[]): Promise<PlaceOrderResult[]> {
    // Place in parallel for speed
    return Promise.all(inputs.map((input) => this.place(input)));
  }

  /**
   * Batch create multiple orders in a single API call
   * Much faster than creating one by one (1 API call instead of N)
   */
  async batchCreate(inputs: CreateOrderInput[]): Promise<PlaceOrderResult[]> {
    if (inputs.length === 0) return [];

    // Generate client order IDs and create managed orders
    const ordersWithIds = inputs.map((input) => {
      const clientOrderId = generateClientOrderId();
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
      return { input, clientOrderId, managedOrder };
    });

    try {
      const response = await this.ordersApi.batchCreateOrders({
        orders: ordersWithIds.map(({ input, clientOrderId }) => ({
          ticker: input.ticker,
          type: "limit" as const,
          side: input.side,
          action: input.action,
          yes_price: input.side === "yes" ? input.price : undefined,
          no_price: input.side === "no" ? input.price : undefined,
          count: input.count,
          client_order_id: clientOrderId,
        })),
      });

      // Map responses back to our results
      const results: PlaceOrderResult[] = [];
      const responseOrders = response.data.orders ?? [];

      for (let i = 0; i < ordersWithIds.length; i++) {
        const { managedOrder } = ordersWithIds[i]!;
        const responseItem = responseOrders[i];
        const order = responseItem?.order;

        if (order?.order_id) {
          managedOrder.id = order.order_id;
          managedOrder.status = this.mapKalshiStatus(order.status);
          results.push({ success: true, order: managedOrder });
        } else {
          managedOrder.status = "failed";
          const errorMsg = responseItem?.error?.message ?? "No order in response";
          results.push({
            success: false,
            order: managedOrder,
            error: errorMsg,
          });
        }
      }

      return results;
    } catch (error) {
      // Mark all orders as failed
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      return ordersWithIds.map(({ managedOrder }) => {
        managedOrder.status = "failed";
        return { success: false, order: managedOrder, error: errorMessage };
      });
    }
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
    if (ordersToCancel.length === 0) return 0;

    // Get order IDs (only orders that have been confirmed by Kalshi)
    const orderIds = ordersToCancel
      .filter((o) => o.id)
      .map((o) => o.id as string);

    if (orderIds.length === 0) return 0;

    // Use batch cancel for efficiency (1 API call instead of N)
    return this.batchCancel(orderIds);
  }

  /**
   * Batch cancel multiple orders in a single API call
   * Much faster than canceling one by one
   */
  async batchCancel(orderIds: string[]): Promise<number> {
    if (orderIds.length === 0) return 0;

    try {
      const response = await this.ordersApi.batchCancelOrders({
        ids: orderIds,
      });

      // Update local order status
      const cancelledOrders = response.data.orders ?? [];
      for (const cancelled of cancelledOrders) {
        // Find by Kalshi order ID and update status
        for (const order of this.orders.values()) {
          if (order.id === cancelled.order_id) {
            order.status = "cancelled";
            break;
          }
        }
      }

      return cancelledOrders.length;
    } catch (err) {
      // Fallback to individual cancels if batch fails
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[OrderManager] Batch cancel failed (${errMsg}), falling back to individual cancels`);

      let cancelledCount = 0;
      for (const orderId of orderIds) {
        try {
          await this.ordersApi.cancelOrder(orderId);
          cancelledCount++;

          // Small delay between individual cancels to avoid rate limiting
          if (orderIds.length > 1) {
            await sleep(200);
          }
        } catch (cancelErr) {
          // If rate limited, wait longer before continuing
          if (isRateLimitError(cancelErr)) {
            console.log("[OrderManager] Rate limited on individual cancel, waiting 2s...");
            await sleep(2000);
            // Retry this one
            try {
              await this.ordersApi.cancelOrder(orderId);
              cancelledCount++;
            } catch {
              // Give up on this order
            }
          }
          // Order may already be filled or cancelled - continue
        }
      }
      return cancelledCount;
    }
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
   * Update quotes for a market (FAST: batch APIs in parallel)
   *
   * This is the main method for market making - optimized for low latency:
   * 1. Batch cancel existing orders (1 API call)
   * 2. Batch create new orders (1 API call)
   * 3. Run both in PARALLEL for ~100ms instead of ~400ms
   *
   * Note: This has a brief "naked" period. Use updateQuoteAtomic() if you
   * need to always have quotes in market.
   */
  async updateQuote(quote: Quote): Promise<{
    cancelled: number;
    placed: PlaceOrderResult[];
  }> {
    // Get existing order IDs for this ticker
    const existingOrders = this.getActive(quote.ticker);
    const existingIds = existingOrders
      .filter((o) => o.id)
      .map((o) => o.id as string);

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

    // Run batch cancel and batch create IN PARALLEL
    // This cuts latency in half: ~200ms instead of ~400ms
    const [cancelled, placed] = await Promise.all([
      existingIds.length > 0 ? this.batchCancel(existingIds) : Promise.resolve(0),
      newOrders.length > 0 ? this.batchCreate(newOrders) : Promise.resolve([]),
    ]);

    return { cancelled, placed };
  }

  /**
   * Update quotes atomically (place new BEFORE canceling old)
   *
   * Slower than updateQuote() but ensures we always have quotes in market.
   * Use this if you're worried about the brief naked period.
   */
  async updateQuoteAtomic(quote: Quote): Promise<{
    cancelled: number;
    placed: PlaceOrderResult[];
  }> {
    // Get existing orders for this ticker BEFORE placing new ones
    const existingOrders = this.getActive(quote.ticker);
    const existingIds = existingOrders
      .filter((o) => o.id)
      .map((o) => o.id as string);

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
    const placed = await this.batchCreate(newOrders);

    // 2. Cancel old orders AFTER new ones are placed
    const cancelled =
      existingIds.length > 0 ? await this.batchCancel(existingIds) : 0;

    return { cancelled, placed };
  }

  /**
   * Update quotes (legacy mode: cancel first, then place - sequential)
   * @deprecated Use updateQuote() for better performance
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

    const placed = await this.batchCreate(orders);

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

  // ========== Reconciliation Methods ==========

  /**
   * Get order by Kalshi order ID (not client order ID)
   */
  getByKalshiId(kalshiOrderId: string): ManagedOrder | undefined {
    for (const order of this.orders.values()) {
      if (order.id === kalshiOrderId) {
        return order;
      }
    }
    return undefined;
  }

  /**
   * Update order status when a fill is received
   * Returns true if order was found and updated
   */
  onFill(kalshiOrderId: string, filledCount: number, totalOrderCount?: number): boolean {
    const order = this.getByKalshiId(kalshiOrderId);
    if (!order) {
      // Order not managed by us (could be from previous session)
      return false;
    }

    order.filledCount += filledCount;

    // Determine if fully filled or partial
    const originalCount = totalOrderCount ?? order.count;
    if (order.filledCount >= originalCount) {
      order.status = "filled";
    } else {
      order.status = "partial";
    }

    return true;
  }

  /**
   * Import existing orders from Kalshi API (for reconciliation on startup)
   * These are orders that existed before this process started
   */
  importFromKalshi(kalshiOrders: Order[]): number {
    let imported = 0;

    for (const ko of kalshiOrders) {
      if (!ko.order_id || !ko.ticker) continue;

      // Skip if we already have this order
      if (this.getByKalshiId(ko.order_id)) continue;

      // Create a managed order from Kalshi order
      const clientOrderId = ko.client_order_id ?? `imported-${ko.order_id}`;

      // Kalshi uses remaining_count for how many are left
      const remainingCount = ko.remaining_count ?? 0;
      // We need to estimate original count - if not available, use remaining as approximation
      const originalCount = remainingCount; // Best we can do without full order history

      const managedOrder: ManagedOrder = {
        id: ko.order_id,
        clientOrderId,
        ticker: ko.ticker,
        side: (ko.side as Side) ?? "yes",
        action: (ko.action as Action) ?? "buy",
        price: ko.yes_price ?? ko.no_price ?? 0,
        count: originalCount,
        status: this.mapKalshiStatus(ko.status),
        createdAt: ko.created_time ? new Date(ko.created_time) : new Date(),
        filledCount: 0, // For imported orders, assume not filled yet (they're resting)
      };

      this.orders.set(clientOrderId, managedOrder);
      imported++;
    }

    return imported;
  }

  /**
   * Get stale orders (open orders older than maxAgeMs)
   */
  getStaleOrders(maxAgeMs: number): ManagedOrder[] {
    const now = Date.now();
    const activeStatuses: OrderStatus[] = ["pending", "open", "partial"];
    const stale: ManagedOrder[] = [];

    for (const order of this.orders.values()) {
      if (!activeStatuses.includes(order.status)) continue;
      if (now - order.createdAt.getTime() > maxAgeMs) {
        stale.push(order);
      }
    }

    return stale;
  }

  /**
   * Get orders that are far from current fair value
   * @param ticker - Market ticker
   * @param fairValue - Current fair value (mid price or microprice)
   * @param maxDistanceCents - Max distance from fair value before considered stale
   */
  getOffPriceOrders(ticker: string, fairValue: number, maxDistanceCents: number): ManagedOrder[] {
    const activeStatuses: OrderStatus[] = ["pending", "open", "partial"];
    const offPrice: ManagedOrder[] = [];

    for (const order of this.orders.values()) {
      if (order.ticker !== ticker) continue;
      if (!activeStatuses.includes(order.status)) continue;

      const distance = Math.abs(order.price - fairValue);
      if (distance > maxDistanceCents) {
        offPrice.push(order);
      }
    }

    return offPrice;
  }

  /**
   * Sync with Kalshi API - fetch current order states and update local tracking
   * Call this periodically or on reconnect to ensure consistency
   */
  async syncWithKalshi(tickers?: string[]): Promise<{
    synced: number;
    cancelled: number;
    updated: number;
  }> {
    try {
      // Fetch open orders from Kalshi with retry on rate limit
      const response = await retryWithBackoff(
        () => this.ordersApi.getOrders(
          undefined, // ticker - fetch all, filter locally
          undefined, // event_ticker
          undefined, // min_ts
          undefined, // max_ts
          "resting", // status - only resting orders
          100        // limit
        ),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      const kalshiOrders = response.data?.orders ?? [];
      let synced = 0;
      let updated = 0;

      for (const ko of kalshiOrders) {
        if (!ko.order_id || !ko.ticker) continue;

        // Filter by tickers if provided
        if (tickers && !tickers.includes(ko.ticker)) continue;

        // Check if we have this order
        const existing = this.getByKalshiId(ko.order_id);

        if (existing) {
          // Update status if changed
          const newStatus = this.mapKalshiStatus(ko.status);
          if (existing.status !== newStatus) {
            existing.status = newStatus;
            updated++;
          }
        } else {
          // Import the order
          this.importFromKalshi([ko]);
          synced++;
        }
      }

      return { synced, cancelled: 0, updated };
    } catch (error) {
      console.error("[OrderManager] syncWithKalshi failed:", error);
      return { synced: 0, cancelled: 0, updated: 0 };
    }
  }

  /**
   * Cancel all open orders and clear local state (for clean restart)
   * Use this on startup to ensure no orphan orders
   * 
   * Includes retry logic for rate limit (429) errors
   */
  async cancelAllAndClear(tickers?: string[]): Promise<number> {
    try {
      // Fetch all resting orders from Kalshi with retry on rate limit
      const response = await retryWithBackoff(
        () => this.ordersApi.getOrders(
          undefined, // ticker
          undefined, // event_ticker
          undefined, // min_ts
          undefined, // max_ts
          "resting", // status
          100        // limit
        ),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      const kalshiOrders = response.data?.orders ?? [];
      const orderIds: string[] = [];

      for (const ko of kalshiOrders) {
        if (!ko.order_id || !ko.ticker) continue;

        // Filter by tickers if provided
        if (tickers && !tickers.includes(ko.ticker)) continue;

        orderIds.push(ko.order_id);
      }

      if (orderIds.length === 0) {
        return 0;
      }

      // Batch cancel with retry on rate limit
      const cancelled = await retryWithBackoff(
        () => this.batchCancel(orderIds),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      // Clear local state for these orders
      for (const order of this.orders.values()) {
        if (!tickers || tickers.includes(order.ticker)) {
          order.status = "cancelled";
        }
      }

      return cancelled;
    } catch (error) {
      console.error("[OrderManager] cancelAllAndClear failed:", error);
      return 0;
    }
  }

  /**
   * Map Kalshi order status to our internal status
   */
  private mapKalshiStatus(status?: string | KalshiOrderStatus): OrderStatus {
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

