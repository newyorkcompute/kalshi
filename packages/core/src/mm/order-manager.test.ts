import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderManager } from "./order-manager.js";
import type { OrdersV2Client } from "./orders-v2.js";

function createMockOrdersV2(): OrdersV2Client {
  return {
    createOrder: vi.fn().mockResolvedValue({
      order_id: "kalshi-order-123",
      client_order_id: "client-1",
      fill_count: "0.00",
      remaining_count: "10.00",
      ts_ms: Date.now(),
    }),
    cancelOrder: vi.fn().mockResolvedValue({
      order_id: "kalshi-order-123",
      reduced_by: "10.00",
      ts_ms: Date.now(),
    }),
    batchCancelOrders: vi.fn().mockImplementation((ids: string[]) => {
      return Promise.resolve({
        orders: ids.map((id) => ({
          order_id: id,
          reduced_by: "10.00",
          ts_ms: Date.now(),
        })),
      });
    }),
    batchCreateOrders: vi.fn().mockResolvedValue({
      orders: [
        {
          order_id: "batch-order-1",
          fill_count: "0.00",
          remaining_count: "10.00",
          ts_ms: Date.now(),
        },
        {
          order_id: "batch-order-2",
          fill_count: "0.00",
          remaining_count: "10.00",
          ts_ms: Date.now(),
        },
      ],
    }),
  };
}

describe("OrderManager", () => {
  let manager: OrderManager;
  let mockApi: OrdersV2Client;

  beforeEach(() => {
    mockApi = createMockOrdersV2();
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

    it("should call V2 API with YES-book bid mapping", async () => {
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
          side: "bid",
          price: "0.5000",
          count: "10.00",
          post_only: true,
          time_in_force: "good_till_canceled",
        })
      );
    });

    it("should map buy NO to YES ask at inverted price", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        price: 50,
        count: 10,
      });

      expect(mockApi.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: "ask",
          price: "0.5000",
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
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      expect(result.cancelled).toBe(1);
      expect(result.placed).toHaveLength(2);
    });

    it("should skip invalid prices", async () => {
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 0,
        bidSize: 10,
        askPrice: 100,
        askSize: 10,
      });

      expect(result.placed).toHaveLength(0);
    });

    it("should skip zero size", async () => {
      const result = await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 0,
        askPrice: 55,
        askSize: 10,
      });

      expect(result.placed).toHaveLength(1);
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

      manager.updateStatus(placed.order!.clientOrderId, "filled");

      const order = manager.get(placed.order!.clientOrderId)!;
      order.createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const removed = manager.cleanup(24 * 60 * 60 * 1000);

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

      const removed = manager.cleanup(0);
      expect(removed).toBe(0);
      expect(manager.getActive()).toHaveLength(1);
    });
  });

  describe("batchCancel", () => {
    it("should cancel multiple orders in one API call", async () => {
      const a = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });
      (mockApi.createOrder as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        order_id: "kalshi-order-456",
        fill_count: "0.00",
        remaining_count: "10.00",
        ts_ms: Date.now(),
      });
      const b = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        price: 55,
        count: 10,
      });

      const cancelled = await manager.batchCancel([
        a.order!.id!,
        b.order!.id!,
      ]);

      expect(cancelled).toBe(2);
      expect(mockApi.batchCancelOrders).toHaveBeenCalledWith([
        "kalshi-order-123",
        "kalshi-order-456",
      ]);
    });

    it("should return 0 for empty array", async () => {
      expect(await manager.batchCancel([])).toBe(0);
    });

    it("should fall back to individual cancels on batch failure", async () => {
      (mockApi.batchCancelOrders as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Batch not supported")
      );

      const placed = await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 50,
        count: 10,
      });

      const cancelled = await manager.batchCancel([placed.order!.id!]);
      expect(cancelled).toBe(1);
      expect(mockApi.cancelOrder).toHaveBeenCalled();
    });
  });

  describe("batchCreate", () => {
    it("should create multiple orders in one API call", async () => {
      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
        { ticker: "TEST-MARKET", side: "yes", action: "sell", price: 55, count: 10 },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].order!.id).toBe("batch-order-1");
      expect(results[1].order!.id).toBe("batch-order-2");
      expect(mockApi.batchCreateOrders).toHaveBeenCalled();
    });

    it("should return empty array for empty input", async () => {
      expect(await manager.batchCreate([])).toEqual([]);
    });

    it("should handle API errors", async () => {
      (mockApi.batchCreateOrders as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("batch failed")
      );

      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
      ]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("batch failed");
    });

    it("should track orders in internal state", async () => {
      const results = await manager.batchCreate([
        { ticker: "TEST-MARKET", side: "yes", action: "buy", price: 45, count: 10 },
        { ticker: "TEST-MARKET", side: "yes", action: "sell", price: 55, count: 10 },
      ]);

      expect(manager.get(results[0].order!.clientOrderId)).toBeDefined();
      expect(manager.get(results[1].order!.clientOrderId)).toBeDefined();
    });
  });

  describe("updateQuote with batch APIs", () => {
    it("should use batch APIs in parallel", async () => {
      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      await manager.updateQuote({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      expect(mockApi.batchCancelOrders).toHaveBeenCalled();
      expect(mockApi.batchCreateOrders).toHaveBeenCalled();
    });
  });

  describe("updateQuoteAtomic", () => {
    it("should place new orders before canceling old ones", async () => {
      const callOrder: string[] = [];
      (mockApi.batchCreateOrders as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push("create");
          return {
            orders: [
              {
                order_id: "new-1",
                fill_count: "0.00",
                remaining_count: "10.00",
                ts_ms: Date.now(),
              },
              {
                order_id: "new-2",
                fill_count: "0.00",
                remaining_count: "10.00",
                ts_ms: Date.now(),
              },
            ],
          };
        }
      );
      (mockApi.batchCancelOrders as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push("cancel");
          return { orders: [{ order_id: "old", reduced_by: "10.00" }] };
        }
      );

      await manager.place({
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        price: 45,
        count: 10,
      });

      await manager.updateQuoteAtomic({
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 48,
        bidSize: 15,
        askPrice: 52,
        askSize: 15,
      });

      expect(callOrder[0]).toBe("create");
      expect(callOrder[1]).toBe("cancel");
    });
  });
});
