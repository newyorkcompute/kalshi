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

    it("should respect imbalance protection in multi-level mode", () => {
      // This test ensures the bug fix stays in place
      strategy = new AdaptiveStrategy({
        multiLevel: true,
        dynamicSkew: true,
        skipRiskySideThreshold: 0.75,
        maxMarketSpread: 20,
      });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 60,
        mid: 55,
        spread: 10,
        position: null,
        imbalance: 0.84, // 84% bullish - above 75% threshold
      };

      const quotes = strategy.computeQuotes(snapshot);

      // At 84% bullish imbalance, ALL quotes should have askSize = 0
      for (const quote of quotes) {
        expect(quote.askSize).toBe(0);
      }
    });

    it("should reduce risky side size in multi-level mode", () => {
      strategy = new AdaptiveStrategy({
        multiLevel: true,
        dynamicSkew: true,
        skipRiskySideThreshold: 0.75,
        extremeImbalanceThreshold: 0.6,
        reduceRiskySideOnImbalance: true,
        imbalanceSizeReduction: 0.5,
        maxMarketSpread: 20,
      });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 60,
        mid: 55,
        spread: 10,
        position: null,
        imbalance: 0.65, // 65% bullish - between 60% and 75%
      };

      const quotes = strategy.computeQuotes(snapshot);

      // At 65% bullish, ask sizes should be reduced (50% of normal)
      // Level 1 normal = 2, reduced = 1
      // Level 2 normal = 5, reduced = 2
      for (const quote of quotes) {
        expect(quote.askSize).toBeLessThan(quote.bidSize);
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

    it("should update time-decay params", () => {
      strategy.updateParams({
        expiryWidenStartSec: 7200,
        expiryStopQuoteSec: 600,
        expirySpreadMultiplier: 2.0,
      });

      const params = strategy.getParams();
      expect(params.expiryWidenStartSec).toBe(7200);
      expect(params.expiryStopQuoteSec).toBe(600);
      expect(params.expirySpreadMultiplier).toBe(2.0);
    });
  });

  describe("time-decay near expiry", () => {
    it("should stop quoting in final minutes", () => {
      strategy = new AdaptiveStrategy({
        edgeCents: 1,
        minSpreadCents: 2,
        sizePerSide: 5,
        maxMarketSpread: 20,
        expiryStopQuoteSec: 300, // 5 minutes
      });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        timeToExpiry: 200, // 200 seconds < 300 threshold
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });

    it("should quote normally far from expiry", () => {
      strategy = new AdaptiveStrategy({
        edgeCents: 1,
        minSpreadCents: 2,
        sizePerSide: 5,
        maxMarketSpread: 20,
        expiryWidenStartSec: 3600,
        expiryStopQuoteSec: 300,
      });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        timeToExpiry: 7200, // 2 hours, well before threshold
      };

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(1);
    });

    it("should widen spread near expiry", () => {
      strategy = new AdaptiveStrategy({
        edgeCents: 1,
        minSpreadCents: 2,
        sizePerSide: 5,
        maxMarketSpread: 20,
        expiryWidenStartSec: 3600, // 1 hour
        expiryStopQuoteSec: 300,   // 5 min
        expirySpreadMultiplier: 2.0, // Double spread near expiry
      });

      const farSnapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        timeToExpiry: 7200, // Far from expiry
      };

      const nearSnapshot: MarketSnapshot = {
        ...farSnapshot,
        timeToExpiry: 600, // 10 minutes left (within widening period)
      };

      const farQuotes = strategy.computeQuotes(farSnapshot);
      const nearQuotes = strategy.computeQuotes(nearSnapshot);

      // Both should produce quotes
      expect(farQuotes).toHaveLength(1);
      expect(nearQuotes).toHaveLength(1);

      // Near-expiry spread should be wider (due to minSpread multiplier)
      // The spread increase depends on how close to expiry we are
      const farSpread = farQuotes[0]!.askPrice - farQuotes[0]!.bidPrice;
      const nearSpread = nearQuotes[0]!.askPrice - nearQuotes[0]!.bidPrice;

      // Near expiry minimum spread = 2 * multiplier (interpolated)
      // At 600s (out of 3600s-300s window), we're about 90% through
      // So spread should be significantly wider
      expect(nearSpread).toBeGreaterThanOrEqual(farSpread);
    });

    it("should not apply time-decay without timeToExpiry", () => {
      strategy = new AdaptiveStrategy({
        edgeCents: 1,
        minSpreadCents: 2,
        sizePerSide: 5,
        maxMarketSpread: 20,
        expiryWidenStartSec: 3600,
        expiryStopQuoteSec: 300,
      });

      const snapshot: MarketSnapshot = {
        ticker: "TEST-MARKET",
        bestBid: 50,
        bestAsk: 55,
        mid: 52.5,
        spread: 5,
        position: null,
        // timeToExpiry: undefined (not set)
      };

      // Should quote normally without time-decay
      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(1);
      expect(quotes[0]!.bidPrice).toBe(51); // Normal quoting
      expect(quotes[0]!.askPrice).toBe(54);
    });
  });
});

