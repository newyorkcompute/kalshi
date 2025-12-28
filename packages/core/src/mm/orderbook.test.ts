import { describe, it, expect, beforeEach } from "vitest";
import { LocalOrderbook, OrderbookManager } from "./orderbook.js";
import type { OrderbookSnapshot, OrderbookDelta } from "./orderbook.js";

describe("LocalOrderbook", () => {
  let orderbook: LocalOrderbook;

  beforeEach(() => {
    orderbook = new LocalOrderbook("TEST-MARKET");
  });

  describe("applySnapshot", () => {
    it("should initialize from snapshot", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10], [49, 20], [48, 30]], // YES bids
        no: [[60, 15], [59, 25]], // NO bids (YES asks = 100 - price)
      };

      orderbook.applySnapshot(snapshot);

      const bbo = orderbook.getBBO();
      expect(bbo).not.toBeNull();
      expect(bbo?.bidPrice).toBe(50); // Best YES bid
      expect(bbo?.askPrice).toBe(40); // 100 - 60 (best NO bid)
      expect(bbo?.spread).toBe(-10); // 40 - 50 = -10 (crossed market)
    });

    it("should handle empty snapshot", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [],
        no: [],
      };

      orderbook.applySnapshot(snapshot);

      expect(orderbook.getBBO()).toBeNull();
      expect(orderbook.getBestBid()).toBeNull();
      expect(orderbook.getBestAsk()).toBeNull();
    });

    it("should filter zero quantity levels", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10], [49, 0], [48, 5]], // 49 has zero qty
        no: [[90, 15]],
      };

      orderbook.applySnapshot(snapshot);

      const depth = orderbook.getDepth(5);
      expect(depth.bids).toHaveLength(2); // 50 and 48, not 49
    });
  });

  describe("applyDelta", () => {
    beforeEach(() => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10]],
        no: [[90, 15]],
      };
      orderbook.applySnapshot(snapshot);
    });

    it("should update existing level", () => {
      const delta: OrderbookDelta = {
        market_ticker: "TEST-MARKET",
        price: 50,
        delta: 25, // Update to 25
        side: "yes",
      };

      orderbook.applyDelta(delta);

      const bid = orderbook.getBestBid();
      expect(bid?.quantity).toBe(25);
    });

    it("should add new level", () => {
      const delta: OrderbookDelta = {
        market_ticker: "TEST-MARKET",
        price: 51,
        delta: 5,
        side: "yes",
      };

      orderbook.applyDelta(delta);

      const bid = orderbook.getBestBid();
      expect(bid?.price).toBe(51); // New best bid
      expect(bid?.quantity).toBe(5);
    });

    it("should remove level when delta is zero", () => {
      const delta: OrderbookDelta = {
        market_ticker: "TEST-MARKET",
        price: 50,
        delta: 0, // Remove
        side: "yes",
      };

      orderbook.applyDelta(delta);

      expect(orderbook.getBestBid()).toBeNull();
    });

    it("should track sequence number", () => {
      const initialSeq = orderbook.getSequence();

      orderbook.applyDelta({
        market_ticker: "TEST-MARKET",
        price: 51,
        delta: 5,
        side: "yes",
      });

      expect(orderbook.getSequence()).toBe(initialSeq + 1);
    });
  });

  describe("getMicroprice", () => {
    it("should calculate size-weighted mid", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10]], // Bid at 50 with size 10
        no: [[40, 20]], // NO bid at 40 = YES ask at 60, size 20
      };

      orderbook.applySnapshot(snapshot);

      const microprice = orderbook.getMicroprice();
      // microprice = (bid * askSize + ask * bidSize) / (bidSize + askSize)
      // = (50 * 20 + 60 * 10) / (10 + 20) = (1000 + 600) / 30 = 53.33
      expect(microprice).toBeCloseTo(53.33, 1);
    });

    it("should return null for empty orderbook", () => {
      expect(orderbook.getMicroprice()).toBeNull();
    });
  });

  describe("getImbalance", () => {
    it("should calculate bid/ask imbalance", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 30]], // More bid depth
        no: [[90, 10]],
      };

      orderbook.applySnapshot(snapshot);

      const imbalance = orderbook.getImbalance();
      // (bidDepth - askDepth) / (bidDepth + askDepth) = (30 - 10) / 40 = 0.5
      expect(imbalance).toBe(0.5);
    });

    it("should return 0 for empty orderbook", () => {
      expect(orderbook.getImbalance()).toBe(0);
    });
  });

  describe("getDepth", () => {
    it("should return sorted levels", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[48, 30], [50, 10], [49, 20]], // Unsorted
        no: [[90, 15], [88, 25]], // NO bids
      };

      orderbook.applySnapshot(snapshot);

      const depth = orderbook.getDepth(3);

      // Bids should be sorted descending (highest first)
      expect(depth.bids[0].price).toBe(50);
      expect(depth.bids[1].price).toBe(49);
      expect(depth.bids[2].price).toBe(48);

      // Asks should be sorted ascending (lowest first)
      expect(depth.asks[0].price).toBe(10); // 100 - 90
      expect(depth.asks[1].price).toBe(12); // 100 - 88
    });

    it("should limit to requested levels", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10], [49, 20], [48, 30], [47, 40], [46, 50]],
        no: [],
      };

      orderbook.applySnapshot(snapshot);

      const depth = orderbook.getDepth(2);
      expect(depth.bids).toHaveLength(2);
    });
  });

  describe("staleness", () => {
    it("should track last update time", () => {
      const snapshot: OrderbookSnapshot = {
        market_ticker: "TEST-MARKET",
        market_id: "123",
        yes: [[50, 10]],
        no: [],
      };

      orderbook.applySnapshot(snapshot);

      expect(orderbook.getAge()).toBeLessThan(100); // Should be very recent
      expect(orderbook.isStale(5000)).toBe(false);
    });
  });
});

describe("OrderbookManager", () => {
  let manager: OrderbookManager;

  beforeEach(() => {
    manager = new OrderbookManager();
  });

  it("should create orderbook on demand", () => {
    const ob1 = manager.getOrderbook("MARKET-1");
    const ob2 = manager.getOrderbook("MARKET-1");

    expect(ob1).toBe(ob2); // Same instance
  });

  it("should apply snapshot to correct orderbook", () => {
    const snapshot: OrderbookSnapshot = {
      market_ticker: "MARKET-1",
      market_id: "123",
      yes: [[50, 10]],
      no: [[90, 15]],
    };

    manager.applySnapshot(snapshot);

    const bbo = manager.getBBO("MARKET-1");
    expect(bbo).not.toBeNull();
    expect(bbo?.bidPrice).toBe(50);
  });

  it("should apply delta to correct orderbook", () => {
    // First apply snapshot
    manager.applySnapshot({
      market_ticker: "MARKET-1",
      market_id: "123",
      yes: [[50, 10]],
      no: [[90, 15]],
    });

    // Then apply delta
    manager.applyDelta({
      market_ticker: "MARKET-1",
      price: 51,
      delta: 5,
      side: "yes",
    });

    const bbo = manager.getBBO("MARKET-1");
    expect(bbo?.bidPrice).toBe(51);
  });

  it("should track multiple markets", () => {
    manager.applySnapshot({
      market_ticker: "MARKET-1",
      market_id: "1",
      yes: [[50, 10]],
      no: [],
    });

    manager.applySnapshot({
      market_ticker: "MARKET-2",
      market_id: "2",
      yes: [[60, 10]],
      no: [],
    });

    expect(manager.getTickers()).toContain("MARKET-1");
    expect(manager.getTickers()).toContain("MARKET-2");
    expect(manager.getTickers()).toHaveLength(2);
  });

  it("should clear all orderbooks", () => {
    manager.applySnapshot({
      market_ticker: "MARKET-1",
      market_id: "1",
      yes: [[50, 10]],
      no: [],
    });

    manager.clear();

    expect(manager.getTickers()).toHaveLength(0);
    expect(manager.getBBO("MARKET-1")).toBeNull();
  });
});

describe("LocalOrderbook - clear", () => {
  it("should clear all data", () => {
    const orderbook = new LocalOrderbook("TEST");
    orderbook.applySnapshot({
      market_ticker: "TEST",
      market_id: "123",
      yes: [[50, 10]],
      no: [[90, 15]],
    });

    expect(orderbook.getBBO()).not.toBeNull();

    orderbook.clear();

    expect(orderbook.getBBO()).toBeNull();
    expect(orderbook.getSequence()).toBe(0);
  });
});

