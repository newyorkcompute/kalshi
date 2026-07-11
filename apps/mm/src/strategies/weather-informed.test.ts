import { describe, it, expect } from "vitest";
import { WeatherInformedStrategy } from "./weather-informed.js";
import type { MarketSnapshot } from "./base.js";

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    ticker: "KXHIGHAUS-26FEB12-T85",
    bestBid: 40,
    bestAsk: 50,
    mid: 45,
    spread: 10,
    position: null,
    modelFairValue: 60,
    ...overrides,
  };
}

describe("WeatherInformedStrategy", () => {
  const strategy = new WeatherInformedStrategy({
    minEdgeCents: 3,
    maxPositionPerMarket: 15,
    sizePerEdgeCent: 2,
    maxOrderSize: 10,
    noNewPositionsFinalHours: 2,
  });

  describe("pre-settlement cutoff", () => {
    it("returns no quotes when flat and within final hours before settlement", () => {
      const snapshot = makeSnapshot({
        timeToExpiry: 3600,
        position: null,
      });

      expect(strategy.computeQuotes(snapshot)).toEqual([]);
    });

    it("still quotes to reduce exposure when inventory is nonzero near settlement", () => {
      const snapshot = makeSnapshot({
        timeToExpiry: 3600,
        modelFairValue: 70,
        bestBid: 80,
        bestAsk: 85,
        mid: 82.5,
        position: {
          ticker: "KXHIGHAUS-26FEB12-T85",
          yesContracts: 10,
          noContracts: 0,
          netExposure: 10,
          costBasis: 500,
          yesCostBasis: 500,
          noCostBasis: 0,
          unrealizedPnL: 0,
        },
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes.length).toBe(1);
      expect(quotes[0].askSize).toBeGreaterThan(0);
    });

    it("allows new positions when time to expiry is beyond cutoff", () => {
      const snapshot = makeSnapshot({
        timeToExpiry: 3 * 3600,
        modelFairValue: 60,
        bestBid: 40,
        bestAsk: 50,
      });

      expect(strategy.computeQuotes(snapshot).length).toBe(1);
    });

    it("allows new positions when timeToExpiry is undefined", () => {
      const snapshot = makeSnapshot({
        timeToExpiry: undefined,
        modelFairValue: 60,
        bestBid: 40,
        bestAsk: 50,
      });

      expect(strategy.computeQuotes(snapshot).length).toBe(1);
    });
  });
});
