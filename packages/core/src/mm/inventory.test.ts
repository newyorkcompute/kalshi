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

  describe("P&L calculation - comprehensive tests", () => {
    it("should calculate correct P&L for simple buy-sell cycle", () => {
      // Buy 3 YES @ 45¢ (cost = 135¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "PITCLE",
        side: "yes",
        action: "buy",
        count: 3,
        price: 45,
        timestamp: new Date(),
      });

      let summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(0); // No realized P&L yet

      // Sell 3 YES @ 50¢ (proceeds = 150¢)
      // P&L = 150 - 135 = 15¢
      tracker.onFill({
        orderId: "order2",
        ticker: "PITCLE",
        side: "yes",
        action: "sell",
        count: 3,
        price: 50,
        timestamp: new Date(),
      });

      summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(15);

      const position = tracker.getPosition("PITCLE");
      expect(position!.yesContracts).toBe(0);
    });

    it("should calculate correct P&L for losing trade", () => {
      // Buy 3 YES @ 45¢ (cost = 135¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "PITCLE",
        side: "yes",
        action: "buy",
        count: 3,
        price: 45,
        timestamp: new Date(),
      });

      // Sell 3 YES @ 44¢ (proceeds = 132¢)
      // P&L = 132 - 135 = -3¢
      tracker.onFill({
        orderId: "order2",
        ticker: "PITCLE",
        side: "yes",
        action: "sell",
        count: 3,
        price: 44,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(-3);
    });

    it("should calculate P&L correctly for partial close", () => {
      // Buy 10 YES @ 50¢ (cost = 500¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 10,
        price: 50,
        timestamp: new Date(),
      });

      // Sell 5 YES @ 60¢ (proceeds = 300¢)
      // Cost of 5 contracts = 250¢ (at avg cost of 50¢)
      // P&L = 300 - 250 = 50¢
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 5,
        price: 60,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(50);

      const position = tracker.getPosition("TEST");
      expect(position!.yesContracts).toBe(5);
      // Remaining cost basis should be 250¢ (5 contracts @ 50¢)
      expect(position!.yesCostBasis).toBe(250);
    });

    it("should handle short selling correctly", () => {
      // Sell 3 YES @ 50¢ (short position, proceeds = 150¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 3,
        price: 50,
        timestamp: new Date(),
      });

      let summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(0); // Opening position, no P&L

      const position = tracker.getPosition("TEST");
      expect(position!.yesContracts).toBe(-3); // SHORT

      // Buy 3 YES @ 45¢ to close (cost = 135¢)
      // P&L = proceeds - cost = 150 - 135 = 15¢
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 3,
        price: 45,
        timestamp: new Date(),
      });

      summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(15);
    });

    it("should handle position flip from long to short", () => {
      // Buy 3 YES @ 45¢ (cost = 135¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 3,
        price: 45,
        timestamp: new Date(),
      });

      // Sell 5 YES @ 50¢ (closes 3 long, opens 2 short)
      // Closing 3: P&L = 3 * (50 - 45) = 15¢
      // Opening 2 short: proceeds = 2 * 50 = 100¢ (stored as cost basis for short)
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 5,
        price: 50,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(15);

      const position = tracker.getPosition("TEST");
      expect(position!.yesContracts).toBe(-2); // 2 SHORT
      expect(position!.yesCostBasis).toBe(100); // Short proceeds stored as cost basis
    });

    it("should handle position flip from short to long", () => {
      // Sell 3 YES @ 50¢ (short position, proceeds = 150¢)
      tracker.onFill({
        orderId: "order1",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 3,
        price: 50,
        timestamp: new Date(),
      });

      // Buy 5 YES @ 45¢ (closes 3 short, opens 2 long)
      // Closing 3 short: P&L = 3 * (50 - 45) = 15¢ (sold at 50, bought back at 45)
      // Opening 2 long: cost = 2 * 45 = 90¢
      tracker.onFill({
        orderId: "order2",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 5,
        price: 45,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(15);

      const position = tracker.getPosition("TEST");
      expect(position!.yesContracts).toBe(2); // 2 LONG
      expect(position!.yesCostBasis).toBe(90); // Long cost basis
    });

    it("should track multiple buy-sell cycles correctly", () => {
      // Cycle 1: Buy 3 @ 45, Sell 3 @ 50 = +15¢
      tracker.onFill({
        orderId: "o1",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 3,
        price: 45,
        timestamp: new Date(),
      });
      tracker.onFill({
        orderId: "o2",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 3,
        price: 50,
        timestamp: new Date(),
      });

      // Cycle 2: Buy 3 @ 48, Sell 3 @ 46 = -6¢
      tracker.onFill({
        orderId: "o3",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 3,
        price: 48,
        timestamp: new Date(),
      });
      tracker.onFill({
        orderId: "o4",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 3,
        price: 46,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(15 - 6); // 9¢
    });

    it("should track YES and NO independently", () => {
      // Buy 5 YES @ 40¢
      tracker.onFill({
        orderId: "o1",
        ticker: "TEST",
        side: "yes",
        action: "buy",
        count: 5,
        price: 40,
        timestamp: new Date(),
      });

      // Buy 5 NO @ 60¢ (these are independent positions!)
      tracker.onFill({
        orderId: "o2",
        ticker: "TEST",
        side: "no",
        action: "buy",
        count: 5,
        price: 60,
        timestamp: new Date(),
      });

      const position = tracker.getPosition("TEST");
      expect(position!.yesContracts).toBe(5);
      expect(position!.noContracts).toBe(5);
      expect(position!.yesCostBasis).toBe(200); // 5 * 40
      expect(position!.noCostBasis).toBe(300); // 5 * 60

      // Sell 5 YES @ 50¢ = +50¢
      tracker.onFill({
        orderId: "o3",
        ticker: "TEST",
        side: "yes",
        action: "sell",
        count: 5,
        price: 50,
        timestamp: new Date(),
      });

      // Sell 5 NO @ 55¢ = -25¢
      tracker.onFill({
        orderId: "o4",
        ticker: "TEST",
        side: "no",
        action: "sell",
        count: 5,
        price: 55,
        timestamp: new Date(),
      });

      const summary = tracker.getPnLSummary();
      expect(summary.realizedToday).toBe(50 - 25); // 25¢
    });
  });
});

