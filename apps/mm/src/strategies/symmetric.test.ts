import { describe, it, expect } from "vitest";
import { SymmetricStrategy } from "./symmetric.js";
import type { MarketSnapshot } from "./base.js";

describe("SymmetricStrategy", () => {
  describe("constructor", () => {
    it("should use default params", () => {
      const strategy = new SymmetricStrategy();
      const params = strategy.getParams();

      expect(params.spreadCents).toBe(4);
      expect(params.sizePerSide).toBe(10);
    });

    it("should accept custom params", () => {
      const strategy = new SymmetricStrategy({
        spreadCents: 6,
        sizePerSide: 20,
      });
      const params = strategy.getParams();

      expect(params.spreadCents).toBe(6);
      expect(params.sizePerSide).toBe(20);
    });
  });

  describe("computeQuotes", () => {
    it("should generate symmetric quotes around mid", () => {
      const strategy = new SymmetricStrategy({ spreadCents: 4, sizePerSide: 10 });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 48,
        bestAsk: 52,
        mid: 50,
        spread: 4,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      expect(quotes[0].ticker).toBe("TEST-MARKET");
      expect(quotes[0].bidPrice).toBe(48); // 50 - 2
      expect(quotes[0].askPrice).toBe(52); // 50 + 2
      expect(quotes[0].bidSize).toBe(10);
      expect(quotes[0].askSize).toBe(10);
    });

    it("should clamp prices to valid range", () => {
      const strategy = new SymmetricStrategy({ spreadCents: 10, sizePerSide: 10 });

      // Near lower bound
      const lowSnapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 2,
        bestAsk: 5,
        mid: 3,
        spread: 3,
        position: null,
      };

      const lowQuotes = strategy.computeQuotes(lowSnapshot);
      expect(lowQuotes[0].bidPrice).toBeGreaterThanOrEqual(1);

      // Near upper bound
      const highSnapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 96,
        bestAsk: 98,
        mid: 97,
        spread: 2,
        position: null,
      };

      const highQuotes = strategy.computeQuotes(highSnapshot);
      expect(highQuotes[0].askPrice).toBeLessThanOrEqual(99);
    });

    it("should skip if spread too wide", () => {
      const strategy = new SymmetricStrategy();

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 30,
        bestAsk: 70, // 40 spread - too wide
        mid: 50,
        spread: 40,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });

    it("should skip if no valid prices", () => {
      const strategy = new SymmetricStrategy();

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 0,
        bestAsk: 0,
        mid: 0,
        spread: 0,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });

    it("should skip if bid >= ask", () => {
      const strategy = new SymmetricStrategy();

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 50, // No spread
        mid: 50,
        spread: 0,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });
  });

  describe("updateParams", () => {
    it("should update spread", () => {
      const strategy = new SymmetricStrategy();
      strategy.updateParams({ spreadCents: 8 });

      expect(strategy.getParams().spreadCents).toBe(8);
    });

    it("should update size", () => {
      const strategy = new SymmetricStrategy();
      strategy.updateParams({ sizePerSide: 25 });

      expect(strategy.getParams().sizePerSide).toBe(25);
    });

    it("should ignore invalid params", () => {
      const strategy = new SymmetricStrategy();
      const original = strategy.getParams();

      strategy.updateParams({ invalidParam: 100 });

      expect(strategy.getParams()).toEqual(original);
    });
  });
});

