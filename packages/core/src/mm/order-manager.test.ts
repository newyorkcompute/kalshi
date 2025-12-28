import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderManager } from "./order-manager.js";
import type { OrdersApi } from "kalshi-typescript";

// Mock OrdersApi
function createMockOrdersApi(): OrdersApi {
  return {
    createOrder: vi.fn().mockResolvedValue({
      data: {
        order: {
          order_id: "kalshi-order-123",
          status: "resting",
        },
      },
    }),
    cancelOrder: vi.fn().mockResolvedValue({}),
    batchCancelOrders: vi.fn().mockImplementation(({ ids }: { ids: string[] }) => {
      return Promise.resolve({
        data: {
          orders: ids.map((id) => ({ order_id: id })),
        },
      });
    }),
    batchCreateOrders: vi.fn().mockResolvedValue({
      data: {
        orders: [
          { order: { order_id: "batch-order-1", status: "resting" } },
          { order: { order_id: "batch-order-2", status: "resting" } },
        ],
      },
    }),
  } as unknown as OrdersApi;
}

describe("OrderManager", () => {
  let manager: OrderManager;
  let mockApi: OrdersApi;

  beforeEach(() => {
    mockApi = createMockOrdersApi();
    manager = new OrderManager(mockApi);
  });

  describe("place", () => {
    it("should place an order successfully", async () => {
      const result = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      expect(result.success).toBe(true);
      expect(result.order).toBeDefined();
      expect(result.order!.id).toBe("kalshi-order-123");
      expect(result.order!.status).toBe("open");
      expect(result.order!.ticker).toBe("TEST-MARKET");
      expect(result.order!.side).toBe("yes");
      expect(result.order!.action).toBe("buy");
      expect(result.order!.price).toBe(50);
      expect(result.order!.count).toBe(10);
    });

    it("should call API with correct parameters", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      expect(mockApi.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: "TEST-MARKET",
          type: "limit",
          side: "yes",
          action: "buy",
          yes_price: 50,
          count: 10,
        })
      );
    });

    it("should use no_price for NO orders", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        price: 50,
        count: 10,
      });

      expect(mockApi.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: "no",
          no_price: 50,
          yes_price: undefined,
        })
      );
    });

    it("should handle API errors", async () => {
      (mockApi.createOrder as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API Error")
      );

      const result = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
      expect(result.order!.status).toBe("failed");
    });

    it("should track order in internal state", async () => {
      const result = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const order = manager.get(result.order!.clientOrderId);
      expect(order).toBeDefined();
      expect(order!.id).toBe("kalshi-order-123");
    });
  });

  describe("placeBulk", () => {
    it("should place multiple orders", async () => {
      const results = await manager.placeBulk([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
        { ticker: "TEST-MARKET", side: "yes", action: "sell", price: 55, count: 10 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });

  describe("cancel", () => {
    it("should cancel an existing order", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const cancelled = await manager.cancel(placed.order!.clientOrderId);

      expect(cancelled).toBe(true);
      expect(mockApi.cancelOrder).toHaveBeenCalledWith("kalshi-order-123");

      const order = manager.get(placed.order!.clientOrderId);
      expect(order!.status).toBe("cancelled");
    });

    it("should return false for unknown order", async () => {
      const cancelled = await manager.cancel("unknown-order");
      expect(cancelled).toBe(false);
    });

    it("should handle cancel API errors gracefully", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      (mockApi.cancelOrder as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Already filled")
      );

      const cancelled = await manager.cancel(placed.order!.clientOrderId);
      expect(cancelled).toBe(false);
    });
  });

  describe("cancelAll", () => {
    it("should cancel all active orders", async () => {
      await manager.place({
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });
      await manager.place({
        ticker: "MARKET-B",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const cancelled = await manager.cancelAll();

      expect(cancelled).toBe(2);
    });

    it("should filter by ticker", async () => {
      await manager.place({
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });
      await manager.place({
        ticker: "MARKET-B",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const cancelled = await manager.cancelAll("MARKET-A");

      expect(cancelled).toBe(1);
    });
  });

  describe("getActive", () => {
    it("should return only active orders", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const active = manager.getActive();
      expect(active).toHaveLength(1);
    });

    it("should filter by ticker", async () => {
      await manager.place({
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });
      await manager.place({
        ticker: "MARKET-B",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const active = manager.getActive("MARKET-A");
      expect(active).toHaveLength(1);
      expect(active[0].ticker).toBe("MARKET-A");
    });

    it("should not include cancelled orders", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      await manager.cancel(placed.order!.clientOrderId);

      const active = manager.getActive();
      expect(active).toHaveLength(0);
    });
  });

  describe("getAll", () => {
    it("should return all orders including cancelled", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      await manager.cancel(placed.order!.clientOrderId);

      const all = manager.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].status).toBe("cancelled");
    });
  });

  describe("updateStatus", () => {
    it("should update order status", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      manager.updateStatus(placed.order!.clientOrderId, "filled", 10, 50);

      const order = manager.get(placed.order!.clientOrderId);
      expect(order!.status).toBe("filled");
      expect(order!.filledCount).toBe(10);
      expect(order!.avgFillPrice).toBe(50);
    });
  });

  describe("updateQuote", () => {
    it("should cancel existing and place new orders", async () => {
      // Place initial order
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      // Update quote
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      expect(result.cancelled).toBe(1);
      expect(result.placed).toHaveLength(2); // bid and ask
    });

    it("should skip invalid prices", async () => {
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 0, // Invalid
        bidSize: 10,
        askPrice: 100, // Invalid
        askSize: 10,
      });

      expect(result.placed).toHaveLength(0);
    });

    it("should skip zero size", async () => {
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 0, // Zero
        askPrice: 55,
        askSize: 10,
      });

      expect(result.placed).toHaveLength(1); // Only ask
    });
  });

  describe("cleanup", () => {
    it("should remove old completed orders", async () => {
      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      // Mark as filled
      manager.updateStatus(placed.order!.clientOrderId, "filled");

      // Backdate the order
      const order = manager.get(placed.order!.clientOrderId)!;
      order.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

      const removed = manager.cleanup(24 * 60 * 60 * 1000); // 24 hour max age

      expect(removed).toBe(1);
      expect(manager.getAll()).toHaveLength(0);
    });

    it("should not remove active orders", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const removed = manager.cleanup(0); // Even with 0 max age

      expect(removed).toBe(0);
      expect(manager.getAll()).toHaveLength(1);
    });
  });

  describe("batchCancel", () => {
    it("should cancel multiple orders in one API call", async () => {
      const result = await manager.batchCancel(["order-1", "order-2", "order-3"]);

      expect(mockApi.batchCancelOrders).toHaveBeenCalledWith({
        ids: ["order-1", "order-2", "order-3"],
      });
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should return 0 for empty array", async () => {
      const result = await manager.batchCancel([]);
      expect(result).toBe(0);
      expect(mockApi.batchCancelOrders).not.toHaveBeenCalled();
    });

    it("should fall back to individual cancels on batch failure", async () => {
      (mockApi.batchCancelOrders as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Batch not supported")
      );

      const result = await manager.batchCancel(["order-1", "order-2"]);

      // Should have attempted individual cancels
      expect(mockApi.cancelOrder).toHaveBeenCalledTimes(2);
      expect(result).toBe(2);
    });
  });

  describe("batchCreate", () => {
    it("should create multiple orders in one API call", async () => {
      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
        { ticker: "TEST-MARKET", side: "yes", action: "sell", price: 55, count: 10 },
      ]);

      expect(mockApi.batchCreateOrders).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].order?.id).toBe("batch-order-1");
      expect(results[1].order?.id).toBe("batch-order-2");
    });

    it("should return empty array for empty input", async () => {
      const results = await manager.batchCreate([]);
      expect(results).toHaveLength(0);
      expect(mockApi.batchCreateOrders).not.toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      (mockApi.batchCreateOrders as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Rate limit exceeded")
      );

      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Rate limit exceeded");
      expect(results[0].order?.status).toBe("failed");
    });

    it("should track orders in internal state", async () => {
      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
      ]);

      const order = manager.get(results[0].order!.clientOrderId);
      expect(order).toBeDefined();
      expect(order?.id).toBe("batch-order-1");
    });
  });

  describe("updateQuote with batch APIs", () => {
    it("should use batch APIs in parallel", async () => {
      // Place initial orders
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      // Update quote - should use batch cancel and batch create
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      // Should have used batch APIs
      expect(mockApi.batchCancelOrders).toHaveBeenCalled();
      expect(mockApi.batchCreateOrders).toHaveBeenCalled();
      expect(result.placed).toHaveLength(2);
    });
  });

  describe("updateQuoteAtomic", () => {
    it("should place new orders before canceling old ones", async () => {
      // Place initial order
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      // Track call order
      const callOrder: string[] = [];
      (mockApi.batchCreateOrders as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push("create");
        return {
          data: {
            orders: [
              { order: { order_id: "new-order-1", status: "resting" } },
              { order: { order_id: "new-order-2", status: "resting" } },
            ],
          },
        };
      });
      (mockApi.batchCancelOrders as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push("cancel");
        return { data: { orders: [{ order_id: "kalshi-order-123" }] } };
      });

      // Update quote atomically
      await manager.updateQuoteAtomic({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      // Create should be called BEFORE cancel
      expect(callOrder).toEqual(["create", "cancel"]);
    });
  });
});

