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
    } catch {
      // Fallback to individual cancels if batch fails
      console.warn("[OrderManager] Batch cancel failed, falling back to individual cancels");
      let cancelledCount = 0;
      for (const orderId of orderIds) {
        try {
          await this.ordersApi.cancelOrder(orderId);
          cancelledCount++;
        } catch {
          // Order may already be filled or cancelled
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

