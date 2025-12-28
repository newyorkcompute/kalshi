import { describe, it, expect, beforeEach } from "vitest";
import { InventoryTracker } from "./inventory.js";
import type { Fill } from "./types.js";

describe("InventoryTracker", () => {
  let tracker: InventoryTracker;

  beforeEach(() => {
    tracker = new InventoryTracker();
  });

  describe("onFill", () => {
    it("should add YES contracts on buy", () => {
      const fill: Fill = {
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      };

      tracker.onFill(fill);

      const position = tracker.getPosition("TEST-MARKET");
      expect(position).toBeDefined();
      expect(position!.yesContracts).toBe(10);
      expect(position!.noContracts).toBe(0);
      expect(position!.netExposure).toBe(10);
    });

    it("should subtract YES contracts on sell", () => {
      // First buy
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      // Then sell
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 5,
        price: 55,
        timestamp: new Date(),
      });

      const position = tracker.getPosition("TEST-MARKET");
      expect(position!.yesContracts).toBe(5);
      expect(position!.netExposure).toBe(5);
    });

    it("should add NO contracts on buy", () => {
      const fill: Fill = {
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      };

      tracker.onFill(fill);

      const position = tracker.getPosition("TEST-MARKET");
      expect(position!.noContracts).toBe(10);
      expect(position!.yesContracts).toBe(0);
      expect(position!.netExposure).toBe(-10); // Negative because NO
    });

    it("should track multiple markets independently", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.onFill({
        orderId: "order2",
        ticker: "MARKET-B",
        side: "yes",
        action: "buy",
        count: 20,
        price: 60,
        timestamp: new Date(),
      });

      expect(tracker.getPosition("MARKET-A")!.yesContracts).toBe(10);
      expect(tracker.getPosition("MARKET-B")!.yesContracts).toBe(20);
    });

    it("should update daily stats", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.onFill({
        orderId: "order2",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 5,
        price: 55,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.fillsToday).toBe(2);
      expect(summary.volumeToday).toBe(15);
    });
  });

  describe("getTotalExposure", () => {
    it("should return 0 with no positions", () => {
      expect(tracker.getTotalExposure()).toBe(0);
    });

    it("should sum absolute exposures across markets", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.onFill({
        orderId: "order2",
        ticker: "MARKET-B",
        side: "no",
        action: "buy",
        count: 5,
        price: 50,
        timestamp: new Date(),
      });

      // A: +10 yes = +10 exposure
      // B: +5 no = -5 exposure (absolute = 5)
      expect(tracker.getTotalExposure()).toBe(15);
    });
  });

  describe("getNetExposure", () => {
    it("should return 0 for unknown ticker", () => {
      expect(tracker.getNetExposure("UNKNOWN")).toBe(0);
    });

    it("should return correct net exposure", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      expect(tracker.getNetExposure("TEST-MARKET")).toBe(10);
    });
  });

  describe("getAllPositions", () => {
    it("should return empty array with no positions", () => {
      expect(tracker.getAllPositions()).toEqual([]);
    });

    it("should return all positions", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.onFill({
        orderId: "order2",
        ticker: "MARKET-B",
        side: "yes",
        action: "buy",
        count: 20,
        price: 60,
        timestamp: new Date(),
      });

      const positions = tracker.getAllPositions();
      expect(positions).toHaveLength(2);
    });
  });

  describe("resetDaily", () => {
    it("should reset daily stats", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.resetDaily();

      const summary = tracker.getPnLSummary();
      expect(summary.fillsToday).toBe(0);
      expect(summary.volumeToday).toBe(0);
      expect(summary.realizedToday).toBe(0);
    });

    it("should preserve positions after reset", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.resetDaily();

      const position = tracker.getPosition("TEST-MARKET");
      expect(position!.yesContracts).toBe(10);
    });
  });

  describe("clear", () => {
    it("should remove all positions", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      tracker.clear();

      expect(tracker.getAllPositions()).toEqual([]);
      expect(tracker.getPosition("TEST-MARKET")).toBeUndefined();
    });
  });

  describe("initializeFromPortfolio", () => {
    it("should initialize positions from portfolio data", () => {
      tracker.initializeFromPortfolio([
        { ticker: "MARKET-A", yesContracts: 10, noContracts: 0, costBasis: 500 },
        { ticker: "MARKET-B", yesContracts: 0, noContracts: 5, costBasis: 250 },
      ]);

      const posA = tracker.getPosition("MARKET-A");
      expect(posA!.yesContracts).toBe(10);
      expect(posA!.netExposure).toBe(10);

      const posB = tracker.getPosition("MARKET-B");
      expect(posB!.noContracts).toBe(5);
      expect(posB!.netExposure).toBe(-5);
    });
  });

  describe("getPnLSummary with currentPrices", () => {
    it("should calculate unrealized PnL for YES position", () => {
      // Buy 10 YES @ 50¢ = 500¢ cost
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      // Current price is 60¢ - unrealized profit = 10 * (60 - 50) = 100¢
      const prices = new Map([["TEST-MARKET", 60]]);
      const summary = tracker.getPnLSummary(prices);

      expect(summary.unrealized).toBe(100);
      expect(summary.total).toBe(100);
    });

    it("should calculate unrealized PnL for NO position", () => {
      // Buy 10 NO @ 40¢ = 400¢ cost
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        count: 10,
        price: 40,
        timestamp: new Date(),
      });

      // Current YES price is 50¢, so NO value = 10 * (100-50) = 500¢
      // Unrealized = 500 - 400 = 100¢
      const prices = new Map([["TEST-MARKET", 50]]);
      const summary = tracker.getPnLSummary(prices);

      expect(summary.unrealized).toBe(100);
    });

    it("should skip positions with zero exposure", () => {
      tracker.initializeFromPortfolio([
        { ticker: "MARKET-A", yesContracts: 0, noContracts: 0, costBasis: 0 },
      ]);

      const prices = new Map([["MARKET-A", 50]]);
      const summary = tracker.getPnLSummary(prices);

      expect(summary.unrealized).toBe(0);
    });

    it("should skip markets without current price", () => {
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      // Empty prices map
      const prices = new Map<string, number>();
      const summary = tracker.getPnLSummary(prices);

      expect(summary.unrealized).toBe(0);
    });
  });

  describe("sell NO contracts", () => {
    it("should subtract NO contracts on sell", () => {
      // First buy NO
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        count: 10,
        price: 40,
        timestamp: new Date(),
      });

      // Then sell NO
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST-MARKET",
        side: "no",
        action: "sell",
        count: 5,
        price: 45,
        timestamp: new Date(),
      });

      const position = tracker.getPosition("TEST-MARKET");
      expect(position!.noContracts).toBe(5);
      expect(position!.netExposure).toBe(-5);
    });

    it("should calculate realized PnL when selling NO", () => {
      // Buy 10 NO @ 40¢
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "no",
        action: "buy",
        count: 10,
        price: 40,
        timestamp: new Date(),
      });

      // Sell 5 NO @ 50¢ - profit = 5 * (50 - 40) = 50¢
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST-MARKET",
        side: "no",
        action: "sell",
        count: 5,
        price: 50,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBeGreaterThan(0);
    });
  });
});

