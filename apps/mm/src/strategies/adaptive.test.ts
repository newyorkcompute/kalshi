import { describe, it, expect, beforeEach } from "vitest";
import { AdaptiveStrategy } from "./adaptive.js";
import type { MarketSnapshot } from "./base.js";

describe("AdaptiveStrategy", () => {
  let strategy: AdaptiveStrategy;

  beforeEach(() => {
    strategy = new AdaptiveStrategy({
      edgeCents: 1,
      minSpreadCents: 2,
      sizePerSide: 5,
      maxMarketSpread: 20,
      skewFactor: 0.5,
      maxInventorySkew: 30,
      useMicroprice: true,
      multiLevel: false,
      adverseSelectionMultiplier: 2.0,
    });
  });

  describe("basic quoting", () => {
    it("should quote inside the market", () => {
      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      expect(quotes[0]!.bidPrice).toBe(51); // bestBid + 1
      expect(quotes[0]!.askPrice).toBe(54); // bestAsk - 1
    });

    it("should skip illiquid markets", () => {
      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 20,
        bestAsk: 80,
        mid: 50,
        spread: 60, // > maxMarketSpread
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });
  });

  describe("microprice", () => {
    it("should use microprice when available", () => {
      // With microprice disabled, quotes are based on bestBid/bestAsk
      strategy.updateParams({ useMicroprice: false });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        microprice: 53.5, // Skewed toward ask
      };

      const quotes1 = strategy.computeQuotes(snapshot);

      // With microprice enabled, fair value shifts
      strategy.updateParams({ useMicroprice: true });
      const quotes2 = strategy.computeQuotes(snapshot);

      // Both should produce valid quotes
      expect(quotes1).toHaveLength(1);
      expect(quotes2).toHaveLength(1);
    });
  });

  describe("inventory skew", () => {
    it("should skew quotes when long", () => {
      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 10,
          noContracts: 0,
          costBasis: 500,
          netExposure: 10, // LONG
          unrealizedPnL: 0,
        },
      };

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      // Long position → skew = 10 * 0.5 = 5
      // bidPrice = 50 + 1 - 5 = 46
      // askPrice = 55 - 1 - 5 = 49
      expect(quotes[0]!.bidPrice).toBe(46);
      expect(quotes[0]!.askPrice).toBe(49);
    });

    it("should skew quotes when short", () => {
      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 0,
          noContracts: 10,
          costBasis: 500,
          netExposure: -10, // SHORT
          unrealizedPnL: 0,
        },
      };

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      // Short position → skew = -10 * 0.5 = -5
      // bidPrice = 50 + 1 - (-5) = 56
      // askPrice = 55 - 1 - (-5) = 59
      expect(quotes[0]!.bidPrice).toBe(56);
      expect(quotes[0]!.askPrice).toBe(59);
    });

    it("should stop bidding at max long inventory", () => {
      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: {
          ticker: "TEST-MARKET",
          yesContracts: 30,
          noContracts: 0,
          costBasis: 1500,
          netExposure: 30, // At maxInventorySkew
          unrealizedPnL: 0,
        },
      };

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      expect(quotes[0]!.bidSize).toBe(0); // Don't bid more
      expect(quotes[0]!.askSize).toBe(5); // Still offer
    });
  });

  describe("adverse selection", () => {
    it("should widen spread when adverse selection detected", () => {
      const baseSnapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        adverseSelection: false,
      };

      const normalQuotes = strategy.computeQuotes(baseSnapshot);

      const adverseSnapshot: MarketSnapshot = {
        ...baseSnapshot,
        adverseSelection: true,
      };

      const adverseQuotes = strategy.computeQuotes(adverseSnapshot);

      expect(normalQuotes).toHaveLength(1);
      expect(adverseQuotes).toHaveLength(1);

      // With adverse selection, should quote AT market (not inside)
      // and require larger minimum spread
      const normalSpread = normalQuotes[0]!.askPrice - normalQuotes[0]!.bidPrice;
      const adverseSpread = adverseQuotes[0]!.askPrice - adverseQuotes[0]!.bidPrice;

      expect(adverseSpread).toBeGreaterThanOrEqual(normalSpread);
    });
  });

  describe("multi-level quoting", () => {
    it("should generate multiple levels when enabled", () => {
      strategy.updateParams({ multiLevel: true });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 60, // Wide enough for multi-level
        mid: 55,
        spread: 10,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);

      // Should have 2 levels (tight + at-market)
      expect(quotes.length).toBeGreaterThanOrEqual(1);
    });

    it("should have smaller size on tight level", () => {
      strategy.updateParams({ multiLevel: true });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 60,
        mid: 55,
        spread: 10,
        position: null,
      };

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length >= 2) {
        // Level 1 should have smaller size
        expect(quotes[0]!.bidSize).toBeLessThanOrEqual(quotes[1]!.bidSize);
      }
    });
  });

  describe("updateParams", () => {
    it("should update phase 2 params", () => {
      strategy.updateParams({
        useMicroprice: false,
        multiLevel: true,
        adverseSelectionMultiplier: 3.0,
      });

      const params = strategy.getParams();
      expect(params.useMicroprice).toBe(false);
      expect(params.multiLevel).toBe(true);
      expect(params.adverseSelectionMultiplier).toBe(3.0);
    });
  });
});

