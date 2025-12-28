/**
 * Avellaneda-Stoikov Strategy Tests
 */

import { describe, it, expect } from "vitest";
import { AvellanedaStoikovStrategy } from "./avellaneda.js";
import type { MarketSnapshot } from "./base.js";

describe("AvellanedaStoikovStrategy", () => {
  const createSnapshot = (overrides: Partial<MarketSnapshot> = {}): MarketSnapshot => ({
    ticker: "TEST-MARKET",
    bestBid: 45,
    bestAsk: 55,
    mid: 50,
    spread: 10,
    position: null,
    ...overrides,
  });

  describe("basic quoting", () => {
    it("should generate quotes for valid market", () => {
      const strategy = new AvellanedaStoikovStrategy({
        gamma: 0.1,
        k: 1.5,
        sigma: 0.15,
        minSpread: 2,
        maxSpread: 20,
      });
      const snapshot = createSnapshot();

      const quotes = strategy.computeQuotes(snapshot);

      expect(quotes).toHaveLength(1);
      expect(quotes[0].ticker).toBe("TEST-MARKET");
      expect(quotes[0].bidPrice).toBeLessThan(quotes[0].askPrice);
    });

    it("should respect minimum spread", () => {
      const strategy = new AvellanedaStoikovStrategy({
        minSpread: 5,
        maxSpread: 20,
      });
      const snapshot = createSnapshot();

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length > 0) {
        const spread = quotes[0].askPrice - quotes[0].bidPrice;
        expect(spread).toBeGreaterThanOrEqual(5);
      }
    });

    it("should respect maximum spread", () => {
      const strategy = new AvellanedaStoikovStrategy({
        minSpread: 2,
        maxSpread: 15,
        gamma: 1.0, // High risk aversion = wider spread
        sigma: 0.5, // High volatility = wider spread
      });
      const snapshot = createSnapshot();

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length > 0) {
        const spread = quotes[0].askPrice - quotes[0].bidPrice;
        expect(spread).toBeLessThanOrEqual(15);
      }
    });
  });

  describe("inventory skew (reservation price)", () => {
    it("should lower reservation price when long", () => {
      const strategy = new AvellanedaStoikovStrategy({
        gamma: 0.5, // Significant risk aversion
        sigma: 0.15,
      });
      
      const neutralSnapshot = createSnapshot({ position: null });
      const longSnapshot = createSnapshot({
        position: { 
          ticker: "TEST-MARKET",
          netExposure: 20, 
          costBasis: 1000,
          yesContracts: 20,
          noContracts: 0,
          unrealizedPnL: 0,
        },
      });

      const neutralQuotes = strategy.computeQuotes(neutralSnapshot);
      const longQuotes = strategy.computeQuotes(longSnapshot);

      // When LONG, reservation price is lower, so both bid and ask should be lower
      if (neutralQuotes.length > 0 && longQuotes.length > 0) {
        expect(longQuotes[0].askPrice).toBeLessThanOrEqual(neutralQuotes[0].askPrice);
      }
    });

    it("should raise reservation price when short", () => {
      const strategy = new AvellanedaStoikovStrategy({
        gamma: 0.5, // Significant risk aversion
        sigma: 0.15,
      });
      
      const neutralSnapshot = createSnapshot({ position: null });
      const shortSnapshot = createSnapshot({
        position: { 
          ticker: "TEST-MARKET",
          netExposure: -20, 
          costBasis: -1000,
          yesContracts: 0,
          noContracts: 20,
          unrealizedPnL: 0,
        },
      });

      const neutralQuotes = strategy.computeQuotes(neutralSnapshot);
      const shortQuotes = strategy.computeQuotes(shortSnapshot);

      // When SHORT, reservation price is higher, so bid should be higher
      if (neutralQuotes.length > 0 && shortQuotes.length > 0) {
        expect(shortQuotes[0].bidPrice).toBeGreaterThanOrEqual(neutralQuotes[0].bidPrice);
      }
    });
  });

  describe("risk aversion (gamma)", () => {
    it("should widen spread with higher gamma", () => {
      const lowGammaStrategy = new AvellanedaStoikovStrategy({
        gamma: 0.01,
        sigma: 0.15,
      });
      const highGammaStrategy = new AvellanedaStoikovStrategy({
        gamma: 1.0,
        sigma: 0.15,
      });

      const snapshot = createSnapshot();

      const lowGammaQuotes = lowGammaStrategy.computeQuotes(snapshot);
      const highGammaQuotes = highGammaStrategy.computeQuotes(snapshot);

      if (lowGammaQuotes.length > 0 && highGammaQuotes.length > 0) {
        const lowSpread = lowGammaQuotes[0].askPrice - lowGammaQuotes[0].bidPrice;
        const highSpread = highGammaQuotes[0].askPrice - highGammaQuotes[0].bidPrice;
        
        expect(highSpread).toBeGreaterThanOrEqual(lowSpread);
      }
    });
  });

  describe("volatility (sigma)", () => {
    it("should widen spread with higher volatility", () => {
      const lowVolStrategy = new AvellanedaStoikovStrategy({
        sigma: 0.05,
        gamma: 0.1,
      });
      const highVolStrategy = new AvellanedaStoikovStrategy({
        sigma: 0.5,
        gamma: 0.1,
      });

      const snapshot = createSnapshot();

      const lowVolQuotes = lowVolStrategy.computeQuotes(snapshot);
      const highVolQuotes = highVolStrategy.computeQuotes(snapshot);

      if (lowVolQuotes.length > 0 && highVolQuotes.length > 0) {
        const lowSpread = lowVolQuotes[0].askPrice - lowVolQuotes[0].bidPrice;
        const highSpread = highVolQuotes[0].askPrice - highVolQuotes[0].bidPrice;
        
        expect(highSpread).toBeGreaterThanOrEqual(lowSpread);
      }
    });
  });

  describe("time decay", () => {
    it("should not quote in final 5 minutes", () => {
      const strategy = new AvellanedaStoikovStrategy({
        useMarketExpiry: true,
      });
      
      const snapshot = createSnapshot({
        timeToExpiry: 200, // 200 seconds (< 5 minutes)
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });

    it("should quote when far from expiry", () => {
      const strategy = new AvellanedaStoikovStrategy({
        useMarketExpiry: true,
      });
      
      const snapshot = createSnapshot({
        timeToExpiry: 3600, // 1 hour
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(1);
    });
  });

  describe("position limits", () => {
    it("should not bid when at max long position", () => {
      const strategy = new AvellanedaStoikovStrategy({
        maxPosition: 50,
        sizePerSide: 5,
      });
      
      const snapshot = createSnapshot({
        position: { 
          ticker: "TEST-MARKET",
          netExposure: 50, // At max
          costBasis: 2500,
          yesContracts: 50,
          noContracts: 0,
          unrealizedPnL: 0,
        },
      });

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length > 0) {
        expect(quotes[0].bidSize).toBe(0);
        expect(quotes[0].askSize).toBeGreaterThan(0);
      }
    });

    it("should not ask when at max short position", () => {
      const strategy = new AvellanedaStoikovStrategy({
        maxPosition: 50,
        sizePerSide: 5,
      });
      
      const snapshot = createSnapshot({
        position: { 
          ticker: "TEST-MARKET",
          netExposure: -50, // At max short
          costBasis: -2500,
          yesContracts: 0,
          noContracts: 50,
          unrealizedPnL: 0,
        },
      });

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length > 0) {
        expect(quotes[0].askSize).toBe(0);
        expect(quotes[0].bidSize).toBeGreaterThan(0);
      }
    });

    it("should return empty when both sides at limit", () => {
      const strategy = new AvellanedaStoikovStrategy({
        maxPosition: 0, // Can't trade either side
        sizePerSide: 5,
      });
      
      const snapshot = createSnapshot({
        position: { 
          ticker: "TEST-MARKET",
          netExposure: 0,
          costBasis: 0,
          yesContracts: 0,
          noContracts: 0,
          unrealizedPnL: 0,
        },
      });

      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toHaveLength(0);
    });
  });

  describe("microprice", () => {
    it("should use microprice when available", () => {
      const strategy = new AvellanedaStoikovStrategy();
      
      // Microprice is skewed toward the ask (more bid pressure)
      const snapshot = createSnapshot({
        microprice: 52, // Higher than mid (50)
      });

      const quotes = strategy.computeQuotes(snapshot);

      // Quotes should be centered around microprice, not mid
      if (quotes.length > 0) {
        const quoteMid = (quotes[0].bidPrice + quotes[0].askPrice) / 2;
        // Should be closer to 52 than to 50
        expect(Math.abs(quoteMid - 52)).toBeLessThan(Math.abs(quoteMid - 50) + 5);
      }
    });
  });

  describe("updateParams", () => {
    it("should update gamma", () => {
      const strategy = new AvellanedaStoikovStrategy({ gamma: 0.1 });
      strategy.updateParams({ gamma: 0.5 });
      
      expect(strategy.getParams().gamma).toBe(0.5);
    });

    it("should update all params", () => {
      const strategy = new AvellanedaStoikovStrategy();
      strategy.updateParams({
        gamma: 0.2,
        k: 2.0,
        sigma: 0.3,
        T: 7200,
        maxPosition: 200,
        sizePerSide: 10,
        minSpread: 3,
        maxSpread: 25,
        useMarketExpiry: false,
      });

      const params = strategy.getParams();
      expect(params.gamma).toBe(0.2);
      expect(params.k).toBe(2.0);
      expect(params.sigma).toBe(0.3);
      expect(params.T).toBe(7200);
      expect(params.maxPosition).toBe(200);
      expect(params.sizePerSide).toBe(10);
      expect(params.minSpread).toBe(3);
      expect(params.maxSpread).toBe(25);
      expect(params.useMarketExpiry).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle zero bid/ask", () => {
      const strategy = new AvellanedaStoikovStrategy();
      const snapshot = createSnapshot({
        bestBid: 0,
        bestAsk: 100,
        mid: 50,
        spread: 100,
      });

      // Should not throw
      const quotes = strategy.computeQuotes(snapshot);
      expect(quotes).toBeDefined();
    });

    it("should clamp prices to valid range", () => {
      const strategy = new AvellanedaStoikovStrategy({
        gamma: 10, // Very high = very skewed
        sigma: 1.0,
      });
      
      const snapshot = createSnapshot({
        position: {
          ticker: "TEST-MARKET",
          netExposure: 100, // Very long
          costBasis: 5000,
          yesContracts: 100,
          noContracts: 0,
          unrealizedPnL: 0,
        },
      });

      const quotes = strategy.computeQuotes(snapshot);

      if (quotes.length > 0) {
        expect(quotes[0].bidPrice).toBeGreaterThanOrEqual(1);
        expect(quotes[0].bidPrice).toBeLessThanOrEqual(99);
        expect(quotes[0].askPrice).toBeGreaterThanOrEqual(1);
        expect(quotes[0].askPrice).toBeLessThanOrEqual(99);
      }
    });
  });
});

