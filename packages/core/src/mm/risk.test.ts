import { describe, it, expect, beforeEach } from "vitest";
import { RiskManager, DEFAULT_RISK_LIMITS } from "./risk.js";
import { InventoryTracker } from "./inventory.js";
import type { Quote, Fill, RiskLimits } from "./types.js";

describe("RiskManager", () => {
  let risk: RiskManager;
  let inventory: InventoryTracker;

  beforeEach(() => {
    risk = new RiskManager();
    inventory = new InventoryTracker();
  });

  describe("constructor", () => {
    it("should use default limits", () => {
      const limits = risk.getLimits();
      expect(limits).toEqual(DEFAULT_RISK_LIMITS);
    });

    it("should allow custom limits", () => {
      const customLimits: Partial<RiskLimits> = {
        maxPositionPerMarket: 50,
        maxDailyLoss: 1000,
      };
      const customRisk = new RiskManager(customLimits);
      const limits = customRisk.getLimits();

      expect(limits.maxPositionPerMarket).toBe(50);
      expect(limits.maxDailyLoss).toBe(1000);
      expect(limits.maxTotalExposure).toBe(DEFAULT_RISK_LIMITS.maxTotalExposure);
    });
  });

  describe("checkQuote", () => {
    it("should allow valid quote", () => {
      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 10,
        askPrice: 55,
        askSize: 10,
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(true);
    });

    it("should reject quote when halted", () => {
      risk.halt("Test halt");

      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 10,
        askPrice: 55,
        askSize: 10,
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("halted");
    });

    it("should reject quote with spread below minimum", () => {
      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 49,
        bidSize: 10,
        askPrice: 50, // Spread = 1, below default min of 2
        askSize: 10,
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Spread");
    });

    it("should reject quote with bid size exceeding max", () => {
      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 100, // Exceeds default max of 25
        askPrice: 55,
        askSize: 10,
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Bid size");
    });

    it("should reject quote with ask size exceeding max", () => {
      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 10,
        askPrice: 55,
        askSize: 100, // Exceeds default max of 25
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Ask size");
    });

    it("should reject quote that would exceed position limit", () => {
      // Add existing position near limit
      inventory.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 90, // Near default limit of 100
        price: 50,
        timestamp: new Date(),
      });

      const quote: Quote = {
        ticker: "TEST-MARKET",
        side: "yes",
        bidPrice: 45,
        bidSize: 20, // Would bring to 110, exceeding 100
        askPrice: 55,
        askSize: 20,
      };

      const result = risk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Position");
    });

    it("should reject quote that would exceed total exposure", () => {
      const customRisk = new RiskManager({ maxTotalExposure: 50 });

      // Add existing exposure
      inventory.onFill({
        orderId: "order1",
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        count: 40,
        price: 50,
        timestamp: new Date(),
      });

      const quote: Quote = {
        ticker: "MARKET-B",
        side: "yes",
        bidPrice: 45,
        bidSize: 20, // Would bring total to 60, exceeding 50
        askPrice: 55,
        askSize: 20,
      };

      const result = customRisk.checkQuote(quote, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Total exposure");
    });
  });

  describe("checkOrder", () => {
    it("should allow valid order", () => {
      const result = risk.checkOrder({ ticker: "TEST-MARKET", count: 10 }, inventory);
      expect(result.allowed).toBe(true);
    });

    it("should reject order when halted", () => {
      risk.halt("Test halt");
      const result = risk.checkOrder({ ticker: "TEST-MARKET", count: 10 }, inventory);
      expect(result.allowed).toBe(false);
    });

    it("should reject order exceeding max size", () => {
      const result = risk.checkOrder({ ticker: "TEST-MARKET", count: 100 }, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Order size");
    });

    it("should reject order that would exceed position limit", () => {
      // Add existing position near limit
      inventory.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 95, // Near default limit of 100
        price: 50,
        timestamp: new Date(),
      });

      // Try to add 10 more - would exceed 100
      const result = risk.checkOrder({ ticker: "TEST-MARKET", count: 10 }, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("position limit");
    });

    it("should reject order that would exceed total exposure limit", () => {
      const customRisk = new RiskManager({ maxTotalExposure: 50 });

      // Add existing exposure
      inventory.onFill({
        orderId: "order1",
        ticker: "MARKET-A",
        side: "yes",
        action: "buy",
        count: 45,
        price: 50,
        timestamp: new Date(),
      });

      // Try to add 10 more in different market - would exceed 50
      const result = customRisk.checkOrder({ ticker: "MARKET-B", count: 10 }, inventory);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("total exposure");
    });
  });

  describe("halt/resume", () => {
    it("should halt trading", () => {
      expect(risk.shouldHalt()).toBe(false);

      risk.halt("Emergency stop");

      expect(risk.shouldHalt()).toBe(true);
      expect(risk.getHaltReason()).toBe("Emergency stop");
    });

    it("should resume trading", () => {
      risk.halt("Emergency stop");
      risk.resume();

      expect(risk.shouldHalt()).toBe(false);
      expect(risk.getHaltReason()).toBeUndefined();
    });
  });

  describe("onFill", () => {
    it("should track daily PnL", () => {
      const fill: Fill = {
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 10,
        price: 55,
        timestamp: new Date(),
      };

      risk.onFill(fill, 50); // 50 cents profit
      expect(risk.getDailyPnL()).toBe(50);
    });

    it("should halt when daily loss limit reached", () => {
      const customRisk = new RiskManager({ maxDailyLoss: 100 });

      const fill: Fill = {
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 10,
        price: 40,
        timestamp: new Date(),
      };

      customRisk.onFill(fill, -150); // 150 cents loss

      expect(customRisk.shouldHalt()).toBe(true);
      expect(customRisk.getHaltReason()).toContain("Daily loss limit");
    });
  });

  describe("resetDaily", () => {
    it("should reset daily PnL", () => {
      const fill: Fill = {
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 10,
        price: 55,
        timestamp: new Date(),
      };

      risk.onFill(fill, 50);
      expect(risk.getDailyPnL()).toBe(50);

      risk.resetDaily();
      expect(risk.getDailyPnL()).toBe(0);
    });

    it("should not auto-resume if halted", () => {
      risk.halt("Loss limit");
      risk.resetDaily();
      expect(risk.shouldHalt()).toBe(true);
    });
  });

  describe("updateLimits", () => {
    it("should update limits", () => {
      risk.updateLimits({ maxPositionPerMarket: 200 });
      expect(risk.getLimits().maxPositionPerMarket).toBe(200);
    });

    it("should preserve other limits", () => {
      const originalMaxDaily = risk.getLimits().maxDailyLoss;
      risk.updateLimits({ maxPositionPerMarket: 200 });
      expect(risk.getLimits().maxDailyLoss).toBe(originalMaxDaily);
    });
  });

  describe("getStatus", () => {
    it("should return correct status", () => {
      inventory.onFill({
        orderId: "order1",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "buy",
        count: 50,
        price: 50,
        timestamp: new Date(),
      });

      const fill: Fill = {
        orderId: "order2",
        ticker: "TEST-MARKET",
        side: "yes",
        action: "sell",
        count: 10,
        price: 55,
        timestamp: new Date(),
      };
      risk.onFill(fill, 50);

      const status = risk.getStatus(inventory);

      expect(status.halted).toBe(false);
      expect(status.dailyPnL).toBe(50);
      expect(status.totalExposure).toBe(50);
      expect(status.utilizationPercent).toBe(10); // 50/500 * 100
    });
  });
});

